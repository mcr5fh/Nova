package trace

import (
	"time"
)

// EventType represents the type of trace event
type EventType string

const (
	EventTypeTaskStarted         EventType = "task_started"
	EventTypeTaskCompleted       EventType = "task_completed"
	EventTypePlanningStarted     EventType = "planning_started"
	EventTypePlanningCompleted   EventType = "planning_completed"
	EventTypeExecutionStarted    EventType = "execution_started"
	EventTypeExecutionCompleted  EventType = "execution_completed"
	EventTypeValidationStarted   EventType = "validation_started"
	EventTypeValidationCompleted EventType = "validation_completed"
	EventTypeEscalation          EventType = "escalation"
)

// Event represents a trace event in the orchestration process
type Event struct {
	EventType EventType `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
	TaskID    string    `json:"task_id"`

	// Task lifecycle fields
	Depth   int    `json:"depth,omitempty"`
	Success bool   `json:"success,omitempty"`
	Message string `json:"message,omitempty"`

	// Planning fields
	Size         string `json:"size,omitempty"`
	ShouldSplit  bool   `json:"should_split,omitempty"`
	SubtaskCount int    `json:"subtask_count,omitempty"`

	// Execution fields
	Attempt    int   `json:"attempt,omitempty"`
	DurationMs int64 `json:"duration_ms,omitempty"`

	// Validation fields
	Passed bool `json:"passed,omitempty"`

	// Escalation fields
	Action string `json:"action,omitempty"`
	Reason string `json:"reason,omitempty"`
}

// NewTaskStartedEvent creates a new task started event
func NewTaskStartedEvent(taskID string, depth int) *Event {
	return &Event{
		EventType: EventTypeTaskStarted,
		Timestamp: time.Now(),
		TaskID:    taskID,
		Depth:     depth,
	}
}

// NewTaskCompletedEvent creates a new task completed event
func NewTaskCompletedEvent(taskID string, success bool, message string) *Event {
	return &Event{
		EventType: EventTypeTaskCompleted,
		Timestamp: time.Now(),
		TaskID:    taskID,
		Success:   success,
		Message:   message,
	}
}

// NewPlanningStartedEvent creates a new planning started event
func NewPlanningStartedEvent(taskID string) *Event {
	return &Event{
		EventType: EventTypePlanningStarted,
		Timestamp: time.Now(),
		TaskID:    taskID,
	}
}

// NewPlanningCompletedEvent creates a new planning completed event
func NewPlanningCompletedEvent(taskID, size string, shouldSplit bool, subtaskCount int) *Event {
	return &Event{
		EventType:    EventTypePlanningCompleted,
		Timestamp:    time.Now(),
		TaskID:       taskID,
		Size:         size,
		ShouldSplit:  shouldSplit,
		SubtaskCount: subtaskCount,
	}
}

// NewExecutionStartedEvent creates a new execution started event
func NewExecutionStartedEvent(taskID string, attempt int) *Event {
	return &Event{
		EventType: EventTypeExecutionStarted,
		Timestamp: time.Now(),
		TaskID:    taskID,
		Attempt:   attempt,
	}
}

// NewExecutionCompletedEvent creates a new execution completed event
func NewExecutionCompletedEvent(taskID string, attempt int, success bool, duration time.Duration) *Event {
	return &Event{
		EventType:  EventTypeExecutionCompleted,
		Timestamp:  time.Now(),
		TaskID:     taskID,
		Attempt:    attempt,
		Success:    success,
		DurationMs: duration.Milliseconds(),
	}
}

// NewValidationStartedEvent creates a new validation started event
func NewValidationStartedEvent(taskID string) *Event {
	return &Event{
		EventType: EventTypeValidationStarted,
		Timestamp: time.Now(),
		TaskID:    taskID,
	}
}

// NewValidationCompletedEvent creates a new validation completed event
func NewValidationCompletedEvent(taskID string, passed bool, message string) *Event {
	return &Event{
		EventType: EventTypeValidationCompleted,
		Timestamp: time.Now(),
		TaskID:    taskID,
		Passed:    passed,
		Message:   message,
	}
}

// NewEscalationEvent creates a new escalation event
func NewEscalationEvent(taskID, action, reason string) *Event {
	return &Event{
		EventType: EventTypeEscalation,
		Timestamp: time.Now(),
		TaskID:    taskID,
		Action:    action,
		Reason:    reason,
	}
}
