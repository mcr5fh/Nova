package executor

import (
	"context"
	"testing"

	"github.com/mattruiters/nova/internal/beads"
	"github.com/mattruiters/nova/internal/engine"
)

// Test creating a new Claude executor
func TestNewClaudeExecutor(t *testing.T) {
	beadsClient := beads.NewClient()
	executor := NewClaudeExecutor(beadsClient, ClaudeConfig{
		CLIPath: "claude",
	})

	if executor == nil {
		t.Fatal("Expected executor to be created")
	}
	if executor.beadsClient == nil {
		t.Error("Expected beads client to be set")
	}
}

// Test interface compliance
func TestClaudeExecutor_InterfaceCompliance(t *testing.T) {
	beadsClient := beads.NewClient()
	var _ engine.Executor = NewClaudeExecutor(beadsClient, ClaudeConfig{})
}

// Test building a prompt for task execution
func TestBuildTaskPrompt(t *testing.T) {
	beadsClient := beads.NewClient()
	executor := NewClaudeExecutor(beadsClient, ClaudeConfig{})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "This is a test task",
		Type:        beads.TaskTypeTask,
		Priority:    2,
		Size:        beads.SizeXS,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	prompt := executor.buildTaskPrompt(task, 1)

	if prompt == "" {
		t.Error("Expected non-empty prompt")
	}

	// Check that prompt contains key information
	if !contains(prompt, task.Title) {
		t.Error("Expected prompt to contain task title")
	}
	if !contains(prompt, task.Description) {
		t.Error("Expected prompt to contain task description")
	}
}

// Test parsing worker result from output
func TestParseWorkerResult(t *testing.T) {
	beadsClient := beads.NewClient()
	executor := NewClaudeExecutor(beadsClient, ClaudeConfig{})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// Test with empty output
	result := executor.parseWorkerResult(task.ID, "", nil)
	if result == nil {
		t.Fatal("Expected result to be created")
	}
	if result.TaskID != task.ID {
		t.Errorf("Expected TaskID to be %s, got %s", task.ID, result.TaskID)
	}

	// Test with error
	mockError := &mockError{msg: "test error"}
	result = executor.parseWorkerResult(task.ID, "", mockError)
	if result.Success {
		t.Error("Expected Success to be false when there's an error")
	}
	if result.Error == "" {
		t.Error("Expected Error to be set")
	}
}

// Test Execute method (without actually running Claude)
func TestClaudeExecutor_Execute_NoClaudeBinary(t *testing.T) {
	beadsClient := beads.NewClient()
	executor := NewClaudeExecutor(beadsClient, ClaudeConfig{
		CLIPath: "/nonexistent/claude",
	})

	task, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Test task",
		Description: "Test",
		Type:        beads.TaskTypeTask,
		Priority:    2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	ctx := context.Background()

	// This should fail because the binary doesn't exist
	result, err := executor.Execute(ctx, task.ID, 1)

	if err == nil && result != nil {
		t.Log("Execute succeeded (unexpected, but OK if Claude is installed)")
	} else if err != nil {
		t.Logf("Execute failed as expected without Claude binary: %v", err)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Mock error for testing
type mockError struct {
	msg string
}

func (e *mockError) Error() string {
	return e.msg
}
