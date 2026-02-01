package llm

import (
	"context"
	"fmt"

	"github.com/mattruiters/nova/baml_client"
	"github.com/mattruiters/nova/baml_client/types"
	"github.com/mattruiters/nova/internal/beads"
	"github.com/mattruiters/nova/internal/engine"
)

// BAMLPlanner implements engine.Planner using BAML
type BAMLPlanner struct {
	beadsClient *beads.Client
}

// NewBAMLPlanner creates a new BAML-based planner
func NewBAMLPlanner(beadsClient *beads.Client) *BAMLPlanner {
	return &BAMLPlanner{
		beadsClient: beadsClient,
	}
}

// Plan implements engine.Planner
func (p *BAMLPlanner) Plan(ctx context.Context, taskID string) (*engine.PlannerOutput, error) {
	// Get the task
	task, err := p.beadsClient.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// Build context string
	contextStr := fmt.Sprintf("Task Type: %s\nPriority: %d", task.Type, task.Priority)
	if task.Notes != "" {
		contextStr += fmt.Sprintf("\nNotes: %s", task.Notes)
	}

	// Call BAML PlanTask function
	bamlResult, err := baml_client.PlanTask(ctx, task.Title, task.Description, contextStr)
	if err != nil {
		return nil, fmt.Errorf("BAML PlanTask failed: %w", err)
	}

	// Convert BAML result to engine types
	result := &engine.PlannerOutput{
		TaskID:      taskID,
		Size:        string(bamlResult.Size),
		ShouldSplit: bamlResult.Should_split,
		Subtasks:    make([]engine.SubtaskDefinition, len(bamlResult.Subtasks)),
		Reasoning:   bamlResult.Reasoning,
	}

	for i, subtask := range bamlResult.Subtasks {
		result.Subtasks[i] = engine.SubtaskDefinition{
			ID:          subtask.Id,
			Title:       subtask.Title,
			Description: subtask.Description,
			Type:        extractTaskType(subtask.Type),
			Priority:    int(subtask.Priority),
			DependsOn:   subtask.Depends_on,
		}
	}

	return result, nil
}

// BAMLValidator implements engine.Validator using BAML
type BAMLValidator struct {
	beadsClient *beads.Client
}

// NewBAMLValidator creates a new BAML-based validator
func NewBAMLValidator(beadsClient *beads.Client) *BAMLValidator {
	return &BAMLValidator{
		beadsClient: beadsClient,
	}
}

// Validate implements engine.Validator
func (v *BAMLValidator) Validate(ctx context.Context, taskID string, result *engine.WorkerResult) (*engine.ValidationResult, error) {
	// Get the task
	task, err := v.beadsClient.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// For now, use empty test output (real implementation would run tests)
	testOutput := "No tests run (validation placeholder)"

	// Call BAML ValidateTask function
	bamlResult, err := baml_client.ValidateTask(ctx, task.Title, task.Description, result.Summary, testOutput)
	if err != nil {
		return nil, fmt.Errorf("BAML ValidateTask failed: %w", err)
	}

	// Convert BAML result to engine types
	validationResult := &engine.ValidationResult{
		TaskID:  taskID,
		Passed:  bamlResult.Passed,
		Message: bamlResult.Message,
		Details: bamlResult.Failures,
	}

	return validationResult, nil
}

// BAMLEscalator implements engine.Escalator using BAML
type BAMLEscalator struct {
	beadsClient *beads.Client
}

// NewBAMLEscalator creates a new BAML-based escalator
func NewBAMLEscalator(beadsClient *beads.Client) *BAMLEscalator {
	return &BAMLEscalator{
		beadsClient: beadsClient,
	}
}

// RouteEscalation implements engine.Escalator
func (e *BAMLEscalator) RouteEscalation(ctx context.Context, taskID string, failureHistory string) (*engine.EscalationDecision, error) {
	// Get the task
	task, err := e.beadsClient.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	lastError := task.LastError
	if lastError == "" {
		lastError = "Unknown error"
	}

	// Call BAML RouteEscalation function
	bamlResult, err := baml_client.RouteEscalation(ctx, task.Title, task.Description, failureHistory, lastError)
	if err != nil {
		return nil, fmt.Errorf("BAML RouteEscalation failed: %w", err)
	}

	// Convert BAML result to engine types
	decision := &engine.EscalationDecision{
		TaskID: taskID,
		Action: convertEscalationAction(bamlResult.Action),
		Reason: bamlResult.Reason,
	}

	if bamlResult.Fixer_prompt != nil {
		decision.FixerPrompt = *bamlResult.Fixer_prompt
	}
	if bamlResult.Human_question != nil {
		decision.HumanPrompt = *bamlResult.Human_question
	}

	return decision, nil
}

// convertEscalationAction converts BAML EscalationAction to engine.EscalationAction
func convertEscalationAction(action types.EscalationAction) engine.EscalationAction {
	switch action {
	case types.EscalationActionFIX:
		return engine.EscalationActionFix
	case types.EscalationActionHUMAN:
		return engine.EscalationActionHuman
	case types.EscalationActionSKIP:
		return engine.EscalationActionSkip
	default:
		return engine.EscalationActionSkip
	}
}

// convertBAMLSubtask converts a BAML subtask to an engine SubtaskDefinition
// This is a helper function that can be tested independently
func convertBAMLSubtask(id, title, description string, priority int64, dependsOn []string) engine.SubtaskDefinition {
	return engine.SubtaskDefinition{
		ID:          id,
		Title:       title,
		Description: description,
		Priority:    int(priority),
		DependsOn:   dependsOn,
	}
}

// extractTaskType extracts the string value from the BAML union type
func extractTaskType(union types.Union3KbugOrKfeatureOrKtask) string {
	if union.IsKtask() {
		if v := union.AsKtask(); v != nil {
			return *v
		}
	}
	if union.IsKbug() {
		if v := union.AsKbug(); v != nil {
			return *v
		}
	}
	if union.IsKfeature() {
		if v := union.AsKfeature(); v != nil {
			return *v
		}
	}
	return "task" // default
}
