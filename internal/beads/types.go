package beads

import (
	"time"
)

// TaskSize represents the estimated size/complexity of a task
type TaskSize string

const (
	SizeXS      TaskSize = "XS" // Extra Small: < 30 min
	SizeS       TaskSize = "S"  // Small: 30 min - 2 hours
	SizeM       TaskSize = "M"  // Medium: 2-8 hours
	SizeL       TaskSize = "L"  // Large: 1-2 days
	SizeXL      TaskSize = "XL" // Extra Large: 2+ days
	SizeUnknown TaskSize = ""   // Not yet sized
)

// TaskStatus represents the current state of a task
type TaskStatus string

const (
	TaskStatusOpen       TaskStatus = "open"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusBlocked    TaskStatus = "blocked"
	TaskStatusClosed     TaskStatus = "closed"
)

// TaskType represents the category of work
type TaskType string

const (
	TaskTypeTask    TaskType = "task"
	TaskTypeBug     TaskType = "bug"
	TaskTypeFeature TaskType = "feature"
)

// Task represents a unit of work in the Beads task tracker
type Task struct {
	// Identity
	ID       string `json:"id"`
	ParentID string `json:"parent_id,omitempty"`

	// Content
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Notes       string `json:"notes,omitempty"`

	// Classification
	Type     TaskType   `json:"type"`
	Size     TaskSize   `json:"size,omitempty"`
	Status   TaskStatus `json:"status"`
	Priority int        `json:"priority"` // 0=P0 (critical), 1=P1, 2=P2 (medium), 3=P3, 4=P4 (backlog)

	// Relationships
	Children  []string `json:"children,omitempty"`
	DependsOn []string `json:"depends_on,omitempty"` // Tasks this task depends on
	BlockedBy []string `json:"blocked_by,omitempty"` // Tasks blocking this task

	// Ownership & tracking
	Assignee  string    `json:"assignee,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	ClosedAt  time.Time `json:"closed_at,omitempty"`

	// Worker execution
	Attempts    int    `json:"attempts"`
	MaxAttempts int    `json:"max_attempts,omitempty"`
	WorkerModel string `json:"worker_model,omitempty"`
	LastError   string `json:"last_error,omitempty"`

	// Artifacts & outputs
	OutputFiles []string               `json:"output_files,omitempty"`
	Artifacts   map[string]interface{} `json:"artifacts,omitempty"`

	// Validation
	ValidationPassed bool   `json:"validation_passed"`
	ValidationReason string `json:"validation_reason,omitempty"`

	// Labels
	Labels []string `json:"labels,omitempty"`
}

// CreateTaskRequest contains parameters for creating a new task
type CreateTaskRequest struct {
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Type        TaskType `json:"type"`
	Priority    int      `json:"priority"`
	ParentID    string   `json:"parent_id,omitempty"`
	Size        TaskSize `json:"size,omitempty"`
	Assignee    string   `json:"assignee,omitempty"`
	Labels      []string `json:"labels,omitempty"`
}

// UpdateTaskRequest contains parameters for updating a task
type UpdateTaskRequest struct {
	Title       *string     `json:"title,omitempty"`
	Description *string     `json:"description,omitempty"`
	Notes       *string     `json:"notes,omitempty"`
	Status      *TaskStatus `json:"status,omitempty"`
	Priority    *int        `json:"priority,omitempty"`
	Size        *TaskSize   `json:"size,omitempty"`
	Assignee    *string     `json:"assignee,omitempty"`
}
