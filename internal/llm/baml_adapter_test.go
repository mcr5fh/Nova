package llm

import (
	"context"
	"testing"

	"github.com/mattruiters/nova/internal/beads"
	"github.com/mattruiters/nova/internal/engine"
)

// Test creating a new BAML planner
func TestNewBAMLPlanner(t *testing.T) {
	beadsClient := beads.NewClient()
	planner := NewBAMLPlanner(beadsClient)

	if planner == nil {
		t.Fatal("Expected planner to be created")
	}
}

// Test BAML planner interface compliance
func TestBAMLPlanner_InterfaceCompliance(t *testing.T) {
	beadsClient := beads.NewClient()
	var _ engine.Planner = NewBAMLPlanner(beadsClient)
}

// Test BAML executor interface compliance
func TestBAMLExecutor_InterfaceCompliance(t *testing.T) {
	beadsClient := beads.NewClient()
	var _ engine.Executor = NewBAMLExecutor(beadsClient)
}

// Test BAML validator interface compliance
func TestBAMLValidator_InterfaceCompliance(t *testing.T) {
	beadsClient := beads.NewClient()
	var _ engine.Validator = NewBAMLValidator(beadsClient)
}

// Test BAML escalator interface compliance
func TestBAMLEscalator_InterfaceCompliance(t *testing.T) {
	beadsClient := beads.NewClient()
	var _ engine.Escalator = NewBAMLEscalator(beadsClient)
}

// Test planning without API key (should fail gracefully)
func TestBAMLPlanner_Plan_NoAPIKey(t *testing.T) {
	beadsClient := beads.NewClient()
	planner := NewBAMLPlanner(beadsClient)

	// Create a test task
	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test description",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// This should fail gracefully without API key
	_, err = planner.Plan(ctx, task.ID)
	if err == nil {
		t.Log("Plan succeeded (unexpected, but OK if API key is set)")
	} else {
		t.Logf("Plan failed as expected without API key: %v", err)
	}
}

// Test executor without API key (should fail gracefully)
func TestBAMLExecutor_Execute_NoAPIKey(t *testing.T) {
	beadsClient := beads.NewClient()
	executor := NewBAMLExecutor(beadsClient)

	// Create a test task
	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test description",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// This should fail gracefully without API key
	_, err = executor.Execute(ctx, task.ID, 1)
	if err == nil {
		t.Log("Execute succeeded (unexpected, but OK if API key is set)")
	} else {
		t.Logf("Execute failed as expected without API key: %v", err)
	}
}

// Test validator without API key (should fail gracefully)
func TestBAMLValidator_Validate_NoAPIKey(t *testing.T) {
	beadsClient := beads.NewClient()
	validator := NewBAMLValidator(beadsClient)

	// Create a test task
	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test description",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// Create a mock worker result
	result := &engine.WorkerResult{
		TaskID:  task.ID,
		Success: true,
		Summary: "Test",
	}

	// This should fail gracefully without API key
	_, err = validator.Validate(ctx, task.ID, result)
	if err == nil {
		t.Log("Validate succeeded (unexpected, but OK if API key is set)")
	} else {
		t.Logf("Validate failed as expected without API key: %v", err)
	}
}

// Test escalator without API key (should fail gracefully)
func TestBAMLEscalator_RouteEscalation_NoAPIKey(t *testing.T) {
	beadsClient := beads.NewClient()
	escalator := NewBAMLEscalator(beadsClient)

	// Create a test task
	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test description",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// This should fail gracefully without API key
	_, err = escalator.RouteEscalation(ctx, task.ID, "Test failure")
	if err == nil {
		t.Log("RouteEscalation succeeded (unexpected, but OK if API key is set)")
	} else {
		t.Logf("RouteEscalation failed as expected without API key: %v", err)
	}
}
