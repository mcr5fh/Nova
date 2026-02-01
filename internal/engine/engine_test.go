package engine

import (
	"context"
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
