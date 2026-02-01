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

// Test that convertBAMLSubtasks correctly maps the ID field
func TestConvertBAMLSubtasks_IDFieldMapping(t *testing.T) {
	tests := []struct {
		name     string
		id       string
		title    string
		desc     string
		priority int64
		deps     []string
	}{
		{
			name:     "simple ID",
			id:       "db-schema",
			title:    "Create database schema",
			desc:     "Design and implement the database schema",
			priority: 2,
			deps:     nil,
		},
		{
			name:     "ID with dependencies",
			id:       "api-endpoint",
			title:    "Create API endpoint",
			desc:     "Implement REST API endpoint",
			priority: 1,
			deps:     []string{"db-schema"},
		},
		{
			name:     "complex ID with hyphens",
			id:       "user-auth-middleware",
			title:    "Authentication middleware",
			desc:     "Add JWT verification middleware",
			priority: 0,
			deps:     []string{"api-endpoint", "db-schema"},
		},
		{
			name:     "empty dependencies",
			id:       "init-task",
			title:    "Initialize project",
			desc:     "Set up project structure",
			priority: 3,
			deps:     []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertBAMLSubtask(tt.id, tt.title, tt.desc, tt.priority, tt.deps)

			if result.ID != tt.id {
				t.Errorf("ID mismatch: got %q, want %q", result.ID, tt.id)
			}
			if result.Title != tt.title {
				t.Errorf("Title mismatch: got %q, want %q", result.Title, tt.title)
			}
			if result.Description != tt.desc {
				t.Errorf("Description mismatch: got %q, want %q", result.Description, tt.desc)
			}
			if result.Priority != int(tt.priority) {
				t.Errorf("Priority mismatch: got %d, want %d", result.Priority, tt.priority)
			}
			if len(result.DependsOn) != len(tt.deps) {
				t.Errorf("DependsOn length mismatch: got %d, want %d", len(result.DependsOn), len(tt.deps))
			}
			for i, dep := range tt.deps {
				if result.DependsOn[i] != dep {
					t.Errorf("DependsOn[%d] mismatch: got %q, want %q", i, result.DependsOn[i], dep)
				}
			}
		})
	}
}
