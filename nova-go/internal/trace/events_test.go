package trace

import (
	"testing"
	"time"
)

func TestNewTaskStartedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewTaskStartedEvent(taskID, 0)

	if event.EventType != EventTypeTaskStarted {
		t.Errorf("expected event type %s, got %s", EventTypeTaskStarted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if event.Depth != 0 {
		t.Errorf("expected depth 0, got %d", event.Depth)
	}

	if event.Timestamp.IsZero() {
		t.Error("expected non-zero timestamp")
	}
}

func TestNewTaskCompletedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewTaskCompletedEvent(taskID, true, "Task completed successfully")

	if event.EventType != EventTypeTaskCompleted {
		t.Errorf("expected event type %s, got %s", EventTypeTaskCompleted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if !event.Success {
		t.Error("expected success to be true")
	}

	if event.Message != "Task completed successfully" {
		t.Errorf("expected message 'Task completed successfully', got %s", event.Message)
	}
}

func TestNewPlanningStartedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewPlanningStartedEvent(taskID)

	if event.EventType != EventTypePlanningStarted {
		t.Errorf("expected event type %s, got %s", EventTypePlanningStarted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}
}

func TestNewPlanningCompletedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewPlanningCompletedEvent(taskID, "M", true, 3)

	if event.EventType != EventTypePlanningCompleted {
		t.Errorf("expected event type %s, got %s", EventTypePlanningCompleted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if event.Size != "M" {
		t.Errorf("expected size M, got %s", event.Size)
	}

	if !event.ShouldSplit {
		t.Error("expected should_split to be true")
	}

	if event.SubtaskCount != 3 {
		t.Errorf("expected subtask count 3, got %d", event.SubtaskCount)
	}
}

func TestNewExecutionStartedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewExecutionStartedEvent(taskID, 2)

	if event.EventType != EventTypeExecutionStarted {
		t.Errorf("expected event type %s, got %s", EventTypeExecutionStarted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if event.Attempt != 2 {
		t.Errorf("expected attempt 2, got %d", event.Attempt)
	}
}

func TestNewExecutionCompletedEvent(t *testing.T) {
	taskID := "test-task-123"
	duration := 1500 * time.Millisecond
	event := NewExecutionCompletedEvent(taskID, 2, true, duration)

	if event.EventType != EventTypeExecutionCompleted {
		t.Errorf("expected event type %s, got %s", EventTypeExecutionCompleted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if event.Attempt != 2 {
		t.Errorf("expected attempt 2, got %d", event.Attempt)
	}

	if !event.Success {
		t.Error("expected success to be true")
	}

	if event.DurationMs != 1500 {
		t.Errorf("expected duration 1500ms, got %d", event.DurationMs)
	}
}

func TestNewValidationStartedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewValidationStartedEvent(taskID)

	if event.EventType != EventTypeValidationStarted {
		t.Errorf("expected event type %s, got %s", EventTypeValidationStarted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}
}

func TestNewValidationCompletedEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewValidationCompletedEvent(taskID, true, "All tests passed")

	if event.EventType != EventTypeValidationCompleted {
		t.Errorf("expected event type %s, got %s", EventTypeValidationCompleted, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if !event.Passed {
		t.Error("expected passed to be true")
	}

	if event.Message != "All tests passed" {
		t.Errorf("expected message 'All tests passed', got %s", event.Message)
	}
}

func TestNewEscalationEvent(t *testing.T) {
	taskID := "test-task-123"
	event := NewEscalationEvent(taskID, "human", "Task failed after 3 attempts")

	if event.EventType != EventTypeEscalation {
		t.Errorf("expected event type %s, got %s", EventTypeEscalation, event.EventType)
	}

	if event.TaskID != taskID {
		t.Errorf("expected task ID %s, got %s", taskID, event.TaskID)
	}

	if event.Action != "human" {
		t.Errorf("expected action 'human', got %s", event.Action)
	}

	if event.Reason != "Task failed after 3 attempts" {
		t.Errorf("expected reason 'Task failed after 3 attempts', got %s", event.Reason)
	}
}
