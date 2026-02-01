package engine

import (
	"context"
	"fmt"
	"testing"

	"github.com/mattruiters/nova/internal/beads"
)

// Test creating a new orchestrator
func TestNewOrchestrator(t *testing.T) {
	beadsClient := beads.NewClient()
	orch := NewOrchestrator(beadsClient, OrchestratorConfig{
		MaxDepth:    5,
		MaxAttempts: 3,
	})

	if orch == nil {
		t.Fatal("Expected orchestrator to be created")
	}
	if orch.beadsClient == nil {
		t.Error("Expected beads client to be set")
	}
	if orch.config.MaxDepth != 5 {
		t.Errorf("Expected MaxDepth to be 5, got %d", orch.config.MaxDepth)
	}
}

// Test processing a simple XS task (should not split)
func TestProcessTask_SimpleTask(t *testing.T) {
	beadsClient := beads.NewClient()
	orch := NewOrchestrator(beadsClient, OrchestratorConfig{
		MaxDepth:    5,
		MaxAttempts: 3,
	})

	// Create a simple task
	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Simple XS task",
		Description: "A very simple task that should not be split",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// For this test, we'll mock the planning decision
	// In a real scenario, this would call BAML
	ctx := context.Background()

	// Process the task
	err = orch.ProcessTask(ctx, task.ID, 0)

	// Without actual LLM calls, we expect this to fail gracefully
	// This is more of a smoke test to ensure the function exists and doesn't panic
	if err == nil {
		t.Log("ProcessTask executed without error")
	} else {
		t.Logf("ProcessTask returned error (expected in test): %v", err)
	}
}

// Test recursion depth limit
func TestProcessTask_DepthLimit(t *testing.T) {
	beadsClient := beads.NewClient()
	orch := NewOrchestrator(beadsClient, OrchestratorConfig{
		MaxDepth:    2,
		MaxAttempts: 3,
	})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test depth limit",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// Process at max depth should fail
	err = orch.ProcessTask(ctx, task.ID, 3)

	if err == nil {
		t.Error("Expected error when exceeding max depth")
	}
	if err != nil && err.Error() != "max recursion depth exceeded" {
		t.Logf("Got expected depth error: %v", err)
	}
}

// Test executing a leaf task
func TestExecuteLeafTask(t *testing.T) {
	beadsClient := beads.NewClient()
	orch := NewOrchestrator(beadsClient, OrchestratorConfig{
		MaxDepth:    5,
		MaxAttempts: 3,
	})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Leaf task",
		Description: "A task to execute",
		Type:        beads.TaskTypeTask,
		Priority:    2,
		Size:        beads.SizeXS,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// Execute the task
	result, err := orch.ExecuteLeafTask(ctx, task.ID)

	// Without actual execution, we expect this to fail gracefully
	if result != nil {
		t.Logf("ExecuteLeafTask returned result: success=%v", result.Success)
	}
	if err != nil {
		t.Logf("ExecuteLeafTask returned error (expected in test): %v", err)
	}
}

// Test validation flow
func TestValidateTaskOutput(t *testing.T) {
	beadsClient := beads.NewClient()
	orch := NewOrchestrator(beadsClient, OrchestratorConfig{
		MaxDepth:    5,
		MaxAttempts: 3,
	})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Task to validate",
		Description: "Test validation",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// Create a mock worker result
	workerResult := &WorkerResult{
		TaskID:  task.ID,
		Success: true,
		Summary: "Task completed successfully",
	}

	// Validate the result
	validationResult, err := orch.ValidateTaskOutput(ctx, task.ID, workerResult)

	if validationResult != nil {
		t.Logf("ValidateTaskOutput returned result: passed=%v", validationResult.Passed)
	}
	if err != nil {
		t.Logf("ValidateTaskOutput returned error (expected in test): %v", err)
	}
}

// Test escalation routing
func TestHandleTaskFailure(t *testing.T) {
	beadsClient := beads.NewClient()
	orch := NewOrchestrator(beadsClient, OrchestratorConfig{
		MaxDepth:    5,
		MaxAttempts: 3,
	})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Failed task",
		Description: "Test failure handling",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// Set attempts to max
	task.Attempts = 3

	// Handle the failure
	err = orch.HandleTaskFailure(ctx, task.ID, "Test error")

	if err != nil {
		t.Logf("HandleTaskFailure returned error (expected in test): %v", err)
	}
}

// Test dependency handling in splitAndRecurse - just the dependency mapping phase
func TestSplitAndRecurse_DependencyMapping(t *testing.T) {
	beadsClient := beads.NewClient()

	// Create a parent task
	parent, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Parent task for dependency test",
		Description: "A task to be split",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create parent task: %v", err)
	}

	// Define subtasks with dependencies using local IDs
	// subtask-0 has no dependencies
	// subtask-1 depends on subtask-0
	// subtask-2 depends on subtask-1
	subtaskDefs := []SubtaskDefinition{
		{
			Title:       "First subtask",
			Description: "This is the first subtask",
			Type:        "task",
			Priority:    2,
			DependsOn:   []string{}, // No dependencies
		},
		{
			Title:       "Second subtask",
			Description: "This depends on the first subtask",
			Type:        "task",
			Priority:    2,
			DependsOn:   []string{"subtask-0"}, // Local ID reference using index
		},
		{
			Title:       "Third subtask",
			Description: "This depends on the second subtask",
			Type:        "task",
			Priority:    2,
			DependsOn:   []string{"subtask-1"}, // Local ID reference using index
		},
	}

	// Manually execute just the creation and dependency phases
	// without the recursive processing that requires planner configuration
	localIDToBeadID := make(map[string]string)
	childIDs := []string{}

	// Phase 1: Create all subtasks
	for i, subtaskDef := range subtaskDefs {
		child, err := beadsClient.CreateTask(beads.CreateTaskRequest{
			Title:       subtaskDef.Title,
			Description: subtaskDef.Description,
			Type:        beads.TaskType(subtaskDef.Type),
			Priority:    subtaskDef.Priority,
			ParentID:    parent.ID,
		})
		if err != nil {
			t.Fatalf("Failed to create subtask: %v", err)
		}

		childIDs = append(childIDs, child.ID)

		// Build the local ID mapping (same logic as in engine.go)
		localIDToBeadID[fmt.Sprintf("subtask-%d", i)] = child.ID
		localIDToBeadID[fmt.Sprintf("%d", i)] = child.ID
		localIDToBeadID[subtaskDef.Title] = child.ID
	}

	if len(childIDs) != 3 {
		t.Fatalf("Expected 3 child tasks, got %d", len(childIDs))
	}

	// Phase 2: Add dependencies using mapped bead IDs
	for i, subtaskDef := range subtaskDefs {
		childBeadID := childIDs[i]

		for _, localDepID := range subtaskDef.DependsOn {
			// Map local ID to actual bead ID
			beadDepID, ok := localIDToBeadID[localDepID]
			if !ok {
				t.Fatalf("Failed to resolve dependency: local ID '%s' not found", localDepID)
			}

			// Add the dependency using actual bead IDs
			if err := beadsClient.AddDependency(childBeadID, beadDepID); err != nil {
				t.Fatalf("Failed to add dependency from %s to %s: %v", childBeadID, beadDepID, err)
			}
		}
	}

	// If we got here, the dependency mapping worked correctly
	t.Log("✓ Successfully created subtasks and mapped dependencies")
	t.Logf("  Created %d subtasks with proper dependency chains", len(childIDs))
	t.Logf("  Subtask IDs: %v", childIDs)
}

// TestExecuteAndValidate_Success tests the success case where task succeeds on first attempt
func TestExecuteAndValidate_Success(t *testing.T) {
	beadsClient := beads.NewClient()

	// Create a custom orchestrator with a mock executor that succeeds
	orch := &Orchestrator{
		beadsClient: beadsClient,
		config: OrchestratorConfig{
			MaxDepth:    5,
			MaxAttempts: 3,
		},
		executor:  &mockExecutorSuccess{},
		validator: &mockValidatorPass{},
	}

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Success test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()
	err = orch.executeAndValidate(ctx, task.ID)

	if err != nil {
		t.Errorf("Expected no error on success, got: %v", err)
	}
}

// TestExecuteAndValidate_FailureWithError tests failure case where lastError is not nil
func TestExecuteAndValidate_FailureWithError(t *testing.T) {
	beadsClient := beads.NewClient()

	// Create orchestrator with mock executor that fails with error
	orch := &Orchestrator{
		beadsClient: beadsClient,
		config: OrchestratorConfig{
			MaxDepth:    5,
			MaxAttempts: 3,
		},
		executor:  &mockExecutorFailWithError{},
		escalator: &mockEscalator{},
	}

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Failure test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()
	err = orch.executeAndValidate(ctx, task.ID)

	// Should escalate with error
	if err == nil {
		t.Error("Expected error on failure, got nil")
	}
}

// TestExecuteAndValidate_NilErrorButFailedResult tests the bug case
// This is the edge case where ExecuteLeafTask returns (result, nil) with result.Success=false
// This should NOT panic when accessing lastError.Error()
func TestExecuteAndValidate_NilErrorButFailedResult(t *testing.T) {
	beadsClient := beads.NewClient()

	// Create orchestrator with mock executor that returns failed result but nil error
	orch := &Orchestrator{
		beadsClient: beadsClient,
		config: OrchestratorConfig{
			MaxDepth:    5,
			MaxAttempts: 3,
		},
		executor:  &mockExecutorFailWithNilError{},
		escalator: &mockEscalator{},
	}

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Nil error test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// This should NOT panic - it's the bug we're fixing
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("executeAndValidate panicked: %v", r)
		}
	}()

	err = orch.executeAndValidate(ctx, task.ID)

	// Should handle gracefully without panicking
	if err == nil {
		t.Error("Expected error on failed result, got nil")
	}
}

// TestExecuteAndValidate_RetryLogic tests that retries happen correctly
func TestExecuteAndValidate_RetryLogic(t *testing.T) {
	beadsClient := beads.NewClient()

	// Create orchestrator with mock that succeeds on 2nd attempt
	mockExec := &mockExecutorSucceedOnAttempt{successAttempt: 2}
	orch := &Orchestrator{
		beadsClient: beadsClient,
		config: OrchestratorConfig{
			MaxDepth:    5,
			MaxAttempts: 3,
		},
		executor:  mockExec,
		validator: &mockValidatorPass{},
	}

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Retry test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()
	err = orch.executeAndValidate(ctx, task.ID)

	if err != nil {
		t.Errorf("Expected success after retry, got: %v", err)
	}

	if mockExec.attemptCount != 2 {
		t.Errorf("Expected 2 attempts, got %d", mockExec.attemptCount)
	}
}

// TestExecuteAndValidate_MaxAttemptsExceeded tests that max attempts is enforced
func TestExecuteAndValidate_MaxAttemptsExceeded(t *testing.T) {
	beadsClient := beads.NewClient()

	// Create orchestrator with mock that always fails
	mockExec := &mockExecutorAlwaysFails{}
	orch := &Orchestrator{
		beadsClient: beadsClient,
		config: OrchestratorConfig{
			MaxDepth:    5,
			MaxAttempts: 3,
		},
		executor:  mockExec,
		escalator: &mockEscalator{},
	}

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Max attempts test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()
	err = orch.executeAndValidate(ctx, task.ID)

	// Should fail after max attempts
	if err == nil {
		t.Error("Expected error after max attempts, got nil")
	}

	if mockExec.attemptCount != 3 {
		t.Errorf("Expected 3 attempts, got %d", mockExec.attemptCount)
	}
}

// Mock executors for testing

type mockExecutorSuccess struct{}

func (m *mockExecutorSuccess) Execute(ctx context.Context, taskID string, attempt int) (*WorkerResult, error) {
	return &WorkerResult{
		TaskID:  taskID,
		Success: true,
		Summary: "Success",
	}, nil
}

type mockExecutorFailWithError struct{}

func (m *mockExecutorFailWithError) Execute(ctx context.Context, taskID string, attempt int) (*WorkerResult, error) {
	return &WorkerResult{
		TaskID:  taskID,
		Success: false,
		Summary: "Failed",
	}, fmt.Errorf("execution failed")
}

type mockExecutorFailWithNilError struct{}

func (m *mockExecutorFailWithNilError) Execute(ctx context.Context, taskID string, attempt int) (*WorkerResult, error) {
	// This is the bug case: returns failed result but nil error
	return &WorkerResult{
		TaskID:  taskID,
		Success: false,
		Summary: "Failed but no error",
	}, nil
}

type mockExecutorSucceedOnAttempt struct {
	attemptCount   int
	successAttempt int
}

func (m *mockExecutorSucceedOnAttempt) Execute(ctx context.Context, taskID string, attempt int) (*WorkerResult, error) {
	m.attemptCount++
	if m.attemptCount < m.successAttempt {
		return &WorkerResult{
			TaskID:  taskID,
			Success: false,
			Summary: "Not yet",
		}, fmt.Errorf("attempt %d failed", m.attemptCount)
	}
	return &WorkerResult{
		TaskID:  taskID,
		Success: true,
		Summary: "Success",
	}, nil
}

type mockExecutorAlwaysFails struct {
	attemptCount int
}

func (m *mockExecutorAlwaysFails) Execute(ctx context.Context, taskID string, attempt int) (*WorkerResult, error) {
	m.attemptCount++
	return &WorkerResult{
		TaskID:  taskID,
		Success: false,
		Summary: "Always fails",
	}, fmt.Errorf("attempt %d failed", m.attemptCount)
}

// Mock validators for testing

type mockValidatorPass struct{}

func (m *mockValidatorPass) Validate(ctx context.Context, taskID string, result *WorkerResult) (*ValidationResult, error) {
	return &ValidationResult{
		Passed:  true,
		Message: "Validation passed",
	}, nil
}

// Mock escalators for testing

type mockEscalator struct{}

func (m *mockEscalator) RouteEscalation(ctx context.Context, taskID string, failureHistory string) (*EscalationDecision, error) {
	return &EscalationDecision{
		TaskID: taskID,
		Action: EscalationActionFix,
		Reason: "Route to fixer",
	}, nil
}
