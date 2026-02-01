package engine

import (
	"context"
	"fmt"

	"github.com/mattruiters/nova/internal/beads"
)

// OrchestratorConfig defines configuration for the orchestrator
type OrchestratorConfig struct {
	MaxDepth    int // Maximum recursion depth
	MaxAttempts int // Maximum retry attempts per task
}

// Orchestrator manages the recursive planning and execution loop
type Orchestrator struct {
	beadsClient *beads.Client
	config      OrchestratorConfig
	planner     Planner
	executor    Executor
	validator   Validator
	escalator   Escalator
}

// Planner interface for task sizing and decomposition
type Planner interface {
	Plan(ctx context.Context, taskID string) (*PlannerOutput, error)
}

// Executor interface for executing leaf tasks
type Executor interface {
	Execute(ctx context.Context, taskID string, attempt int) (*WorkerResult, error)
}

// Validator interface for validating task outputs
type Validator interface {
	Validate(ctx context.Context, taskID string, result *WorkerResult) (*ValidationResult, error)
}

// Escalator interface for handling failures
type Escalator interface {
	RouteEscalation(ctx context.Context, taskID string, failureHistory string) (*EscalationDecision, error)
}

// NewOrchestrator creates a new task orchestrator
func NewOrchestrator(beadsClient *beads.Client, config OrchestratorConfig) *Orchestrator {
	return &Orchestrator{
		beadsClient: beadsClient,
		config:      config,
		// Planner, Executor, Validator, and Escalator will be injected later
	}
}

// SetPlanner sets the planner implementation
func (o *Orchestrator) SetPlanner(planner Planner) {
	o.planner = planner
}

// SetExecutor sets the executor implementation
func (o *Orchestrator) SetExecutor(executor Executor) {
	o.executor = executor
}

// SetValidator sets the validator implementation
func (o *Orchestrator) SetValidator(validator Validator) {
	o.validator = validator
}

// SetEscalator sets the escalator implementation
func (o *Orchestrator) SetEscalator(escalator Escalator) {
	o.escalator = escalator
}

// ProcessTask is the main entry point for processing a task
// It recursively plans, splits, and executes tasks
func (o *Orchestrator) ProcessTask(ctx context.Context, taskID string, depth int) error {
	// Check recursion depth
	if depth >= o.config.MaxDepth {
		return fmt.Errorf("max recursion depth exceeded")
	}

	// Get the task
	task, err := o.beadsClient.GetTask(taskID)
	if err != nil {
		return fmt.Errorf("failed to get task: %w", err)
	}

	// Mark task as in progress
	if err := o.beadsClient.UpdateTaskStatus(taskID, beads.TaskStatusInProgress); err != nil {
		return fmt.Errorf("failed to update task status: %w", err)
	}

	// If task already has a size and it's XS, execute directly
	if task.Size == beads.SizeXS {
		return o.executeAndValidate(ctx, taskID)
	}

	// Plan the task (size and split decision)
	if o.planner == nil {
		return fmt.Errorf("planner not configured")
	}

	planResult, err := o.planner.Plan(ctx, taskID)
	if err != nil {
		return fmt.Errorf("planning failed: %w", err)
	}

	// Update task size
	size := beads.TaskSize(planResult.Size)
	if err := o.beadsClient.UpdateTask(taskID, beads.UpdateTaskRequest{
		Size: &size,
	}); err != nil {
		return fmt.Errorf("failed to update task size: %w", err)
	}

	// If should split, create subtasks and recurse
	if planResult.ShouldSplit {
		return o.splitAndRecurse(ctx, taskID, planResult.Subtasks, depth)
	}

	// Otherwise, execute as a leaf task
	return o.executeAndValidate(ctx, taskID)
}

// splitAndRecurse creates subtasks and processes them recursively
func (o *Orchestrator) splitAndRecurse(ctx context.Context, parentID string, subtaskDefs []SubtaskDefinition, depth int) error {
	// Phase 1: Create all subtasks and build a map from local ID to bead ID
	localIDToBeadID := make(map[string]string)
	childIDs := []string{}

	for i, subtaskDef := range subtaskDefs {
		child, err := o.beadsClient.CreateTask(beads.CreateTaskRequest{
			Title:       subtaskDef.Title,
			Description: subtaskDef.Description,
			Type:        beads.TaskType(subtaskDef.Type),
			Priority:    subtaskDef.Priority,
			ParentID:    parentID,
		})
		if err != nil {
			return fmt.Errorf("failed to create subtask: %w", err)
		}

		childIDs = append(childIDs, child.ID)

		// Map local identifiers to the actual bead ID
		// Support multiple local ID formats:
		// - "subtask-0", "subtask-1", etc. (subtask-N format)
		// - "0", "1", "2", etc. (numeric index)
		// - The title itself
		localIDToBeadID[fmt.Sprintf("subtask-%d", i)] = child.ID
		localIDToBeadID[fmt.Sprintf("%d", i)] = child.ID
		localIDToBeadID[subtaskDef.Title] = child.ID
	}

	// Phase 2: Add dependencies using mapped bead IDs
	for i, subtaskDef := range subtaskDefs {
		childBeadID := childIDs[i]

		for _, localDepID := range subtaskDef.DependsOn {
			// Map local ID to actual bead ID
			beadDepID, ok := localIDToBeadID[localDepID]
			if !ok {
				return fmt.Errorf("failed to resolve dependency: local ID '%s' not found in subtask definitions", localDepID)
			}

			// Add the dependency using actual bead IDs
			if err := o.beadsClient.AddDependency(childBeadID, beadDepID); err != nil {
				return fmt.Errorf("failed to add dependency from %s to %s: %w", childBeadID, beadDepID, err)
			}
		}
	}

	// Process each child task recursively
	for _, childID := range childIDs {
		if err := o.ProcessTask(ctx, childID, depth+1); err != nil {
			return fmt.Errorf("failed to process child task %s: %w", childID, err)
		}
	}

	// If all children completed successfully, mark parent as complete
	allComplete := true
	for _, childID := range childIDs {
		child, err := o.beadsClient.GetTask(childID)
		if err != nil {
			return fmt.Errorf("failed to get child task: %w", err)
		}
		if child.Status != beads.TaskStatusClosed {
			allComplete = false
			break
		}
	}

	if allComplete {
		if err := o.beadsClient.CloseTask(parentID, "All subtasks completed"); err != nil {
			return fmt.Errorf("failed to close parent task: %w", err)
		}
	}

	return nil
}

// executeAndValidate executes a leaf task and validates the result
func (o *Orchestrator) executeAndValidate(ctx context.Context, taskID string) error {
	// Execute the task with retries
	var lastError error
	var result *WorkerResult

	for attempt := 1; attempt <= o.config.MaxAttempts; attempt++ {
		result, lastError = o.ExecuteLeafTask(ctx, taskID)
		if lastError == nil && result != nil && result.Success {
			break
		}

		// Update attempt count
		task, err := o.beadsClient.GetTask(taskID)
		if err != nil {
			return fmt.Errorf("failed to get task: %w", err)
		}
		task.Attempts = attempt
		// Only set LastError if lastError is not nil
		if lastError != nil {
			task.LastError = lastError.Error()
		} else {
			// Failed result but no error - use result error message or generic message
			if result != nil && result.Error != "" {
				task.LastError = result.Error
			} else {
				task.LastError = "task failed without error details"
			}
		}
	}

	// If all attempts failed, escalate
	if lastError != nil || result == nil || !result.Success {
		errorMsg := "task failed"
		if lastError != nil {
			errorMsg = lastError.Error()
		} else if result != nil && result.Error != "" {
			errorMsg = result.Error
		}
		return o.HandleTaskFailure(ctx, taskID, errorMsg)
	}

	// Validate the result
	validationResult, err := o.ValidateTaskOutput(ctx, taskID, result)
	if err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// If validation passed, close the task
	if validationResult.Passed {
		if err := o.beadsClient.CloseTask(taskID, "Task completed and validated"); err != nil {
			return fmt.Errorf("failed to close task: %w", err)
		}
		return nil
	}

	// If validation failed, retry or escalate
	return o.HandleTaskFailure(ctx, taskID, validationResult.Message)
}

// ExecuteLeafTask executes a single leaf task
func (o *Orchestrator) ExecuteLeafTask(ctx context.Context, taskID string) (*WorkerResult, error) {
	if o.executor == nil {
		return nil, fmt.Errorf("executor not configured")
	}

	task, err := o.beadsClient.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// Execute the task
	result, err := o.executor.Execute(ctx, taskID, task.Attempts+1)
	if err != nil {
		return nil, fmt.Errorf("execution failed: %w", err)
	}

	return result, nil
}

// ValidateTaskOutput validates the output of a task
func (o *Orchestrator) ValidateTaskOutput(ctx context.Context, taskID string, result *WorkerResult) (*ValidationResult, error) {
	if o.validator == nil {
		return nil, fmt.Errorf("validator not configured")
	}

	// Validate the task output
	validationResult, err := o.validator.Validate(ctx, taskID, result)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Update task validation status
	task, err := o.beadsClient.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	task.ValidationPassed = validationResult.Passed
	task.ValidationReason = validationResult.Message

	return validationResult, nil
}

// HandleTaskFailure handles a task that has failed after retries
func (o *Orchestrator) HandleTaskFailure(ctx context.Context, taskID string, errorMsg string) error {
	if o.escalator == nil {
		return fmt.Errorf("escalator not configured")
	}

	task, err := o.beadsClient.GetTask(taskID)
	if err != nil {
		return fmt.Errorf("failed to get task: %w", err)
	}

	// Build failure history
	failureHistory := fmt.Sprintf("Attempts: %d, Last error: %s", task.Attempts, errorMsg)

	// Get escalation decision
	decision, err := o.escalator.RouteEscalation(ctx, taskID, failureHistory)
	if err != nil {
		return fmt.Errorf("escalation routing failed: %w", err)
	}

	// Handle the escalation action
	switch decision.Action {
	case EscalationActionFix:
		// Send to fixer LLM (not implemented in this phase)
		return fmt.Errorf("fixer escalation not yet implemented: %s", decision.Reason)

	case EscalationActionHuman:
		// Request human intervention
		return fmt.Errorf("human intervention required: %s - %s", decision.Reason, decision.HumanPrompt)

	case EscalationActionSkip:
		// Mark as blocked
		if err := o.beadsClient.UpdateTaskStatus(taskID, beads.TaskStatusBlocked); err != nil {
			return fmt.Errorf("failed to mark task as blocked: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("unknown escalation action: %s", decision.Action)
	}
}
