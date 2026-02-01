package beads

import (
	"testing"
)

// Test Task creation with all required fields
func TestTaskCreation(t *testing.T) {
	task := Task{
		ID:          "test-1",
		ParentID:    "",
		Title:       "Test Task",
		Description: "Test description",
		Type:        TaskTypeBug,
		Status:      TaskStatusOpen,
		Priority:    2,
	}

	if task.ID != "test-1" {
		t.Errorf("Expected ID to be 'test-1', got '%s'", task.ID)
	}
	if task.Title != "Test Task" {
		t.Errorf("Expected Title to be 'Test Task', got '%s'", task.Title)
	}
	if task.Type != TaskTypeBug {
		t.Errorf("Expected Type to be TaskTypeBug, got '%s'", task.Type)
	}
	if task.Status != TaskStatusOpen {
		t.Errorf("Expected Status to be TaskStatusOpen, got '%s'", task.Status)
	}
	if task.Priority != 2 {
		t.Errorf("Expected Priority to be 2, got %d", task.Priority)
	}
}

// Test Size validation
func TestSizeValidation(t *testing.T) {
	validSizes := []TaskSize{SizeXS, SizeS, SizeM, SizeL, SizeXL, SizeUnknown}

	for _, size := range validSizes {
		if !isValidSize(size) {
			t.Errorf("Expected size '%s' to be valid", size)
		}
	}
}

// Test TaskStatus values
func TestTaskStatusValues(t *testing.T) {
	validStatuses := []TaskStatus{
		TaskStatusOpen,
		TaskStatusInProgress,
		TaskStatusBlocked,
		TaskStatusClosed,
	}

	for _, status := range validStatuses {
		if status == "" {
			t.Errorf("TaskStatus should not be empty")
		}
	}
}

// Test TaskType values
func TestTaskTypeValues(t *testing.T) {
	validTypes := []TaskType{
		TaskTypeTask,
		TaskTypeBug,
		TaskTypeFeature,
	}

	for _, taskType := range validTypes {
		if taskType == "" {
			t.Errorf("TaskType should not be empty")
		}
	}
}

// Test Priority validation
func TestPriorityValidation(t *testing.T) {
	validPriorities := []int{0, 1, 2, 3, 4}
	invalidPriorities := []int{-1, 5, 10}

	for _, p := range validPriorities {
		if !isValidPriority(p) {
			t.Errorf("Expected priority %d to be valid", p)
		}
	}

	for _, p := range invalidPriorities {
		if isValidPriority(p) {
			t.Errorf("Expected priority %d to be invalid", p)
		}
	}
}

// Test dependency management
func TestTaskDependencies(t *testing.T) {
	task := Task{
		ID:        "task-1",
		Title:     "Task with deps",
		DependsOn: []string{"task-2", "task-3"},
		BlockedBy: []string{},
	}

	if len(task.DependsOn) != 2 {
		t.Errorf("Expected 2 dependencies, got %d", len(task.DependsOn))
	}

	if task.DependsOn[0] != "task-2" {
		t.Errorf("Expected first dependency to be 'task-2', got '%s'", task.DependsOn[0])
	}
}

// Helper function that should exist (we'll implement it)
func isValidSize(size TaskSize) bool {
	switch size {
	case SizeXS, SizeS, SizeM, SizeL, SizeXL, SizeUnknown:
		return true
	}
	return false
}

// Helper function for priority validation
func isValidPriority(p int) bool {
	return p >= 0 && p <= 4
}
