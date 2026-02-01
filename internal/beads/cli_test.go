package beads

import (
	"testing"
)

// Test CreateTask function
func TestCreateTask(t *testing.T) {
	cli := NewClient()

	task, err := cli.CreateTask(CreateTaskRequest{
		Title:       "Test task",
		Description: "Test description",
		Type:        TaskTypeTask,
		Priority:    2,
	})

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task == nil {
		t.Fatal("Expected task to be created, got nil")
	}

	if task.Title != "Test task" {
		t.Errorf("Expected title 'Test task', got '%s'", task.Title)
	}

	if task.Status != TaskStatusOpen {
		t.Errorf("Expected status to be Open, got '%s'", task.Status)
	}
}

// Test GetTask function
func TestGetTask(t *testing.T) {
	cli := NewClient()

	// First create a task
	created, err := cli.CreateTask(CreateTaskRequest{
		Title:    "Test task",
		Type:     TaskTypeTask,
		Priority: 2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// Now retrieve it
	task, err := cli.GetTask(created.ID)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task == nil {
		t.Fatal("Expected task to be retrieved, got nil")
	}

	if task.ID != created.ID {
		t.Errorf("Expected ID '%s', got '%s'", created.ID, task.ID)
	}
}

// Test UpdateTaskStatus function
func TestUpdateTaskStatus(t *testing.T) {
	cli := NewClient()

	// Create a task first
	task, err := cli.CreateTask(CreateTaskRequest{
		Title:    "Test task",
		Type:     TaskTypeTask,
		Priority: 2,
	})
	if err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// Update status
	err = cli.UpdateTaskStatus(task.ID, TaskStatusInProgress)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify the update
	updated, err := cli.GetTask(task.ID)
	if err != nil {
		t.Fatalf("Failed to get task: %v", err)
	}

	if updated.Status != TaskStatusInProgress {
		t.Errorf("Expected status InProgress, got '%s'", updated.Status)
	}
}

// Test AddDependency function
func TestAddDependency(t *testing.T) {
	cli := NewClient()

	// Create two tasks
	task1, _ := cli.CreateTask(CreateTaskRequest{
		Title:    "Task 1",
		Type:     TaskTypeTask,
		Priority: 2,
	})
	task2, _ := cli.CreateTask(CreateTaskRequest{
		Title:    "Task 2",
		Type:     TaskTypeTask,
		Priority: 2,
	})

	// Add dependency: task1 depends on task2
	err := cli.AddDependency(task1.ID, task2.ID)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify the dependency
	updated, _ := cli.GetTask(task1.ID)
	if len(updated.DependsOn) != 1 {
		t.Errorf("Expected 1 dependency, got %d", len(updated.DependsOn))
	}
	if len(updated.DependsOn) > 0 && updated.DependsOn[0] != task2.ID {
		t.Errorf("Expected dependency on '%s', got '%s'", task2.ID, updated.DependsOn[0])
	}
}

// Test CloseTask function
func TestCloseTask(t *testing.T) {
	cli := NewClient()

	task, _ := cli.CreateTask(CreateTaskRequest{
		Title:    "Test task",
		Type:     TaskTypeTask,
		Priority: 2,
	})

	err := cli.CloseTask(task.ID, "Task completed successfully")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updated, _ := cli.GetTask(task.ID)
	if updated.Status != TaskStatusClosed {
		t.Errorf("Expected status Closed, got '%s'", updated.Status)
	}
}

// Test ListReadyTasks function
func TestListReadyTasks(t *testing.T) {
	cli := NewClient()

	// Create a task with no dependencies (should be ready)
	task, _ := cli.CreateTask(CreateTaskRequest{
		Title:    "Ready task",
		Type:     TaskTypeTask,
		Priority: 2,
	})

	ready, err := cli.ListReadyTasks()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	found := false
	for _, t := range ready {
		if t.ID == task.ID {
			found = true
			break
		}
	}

	if !found {
		t.Error("Expected to find the created task in ready tasks list")
	}
}
