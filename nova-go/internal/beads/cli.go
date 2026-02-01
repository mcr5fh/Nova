package beads

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Client provides methods to interact with the Beads task tracker
type Client struct {
	// In-memory storage for MVP
	// In production, this would interact with the actual beads CLI or API
	tasks map[string]*Task
}

// NewClient creates a new Beads client
func NewClient() *Client {
	return &Client{
		tasks: make(map[string]*Task),
	}
}

// CreateTask creates a new task in Beads
func (c *Client) CreateTask(req CreateTaskRequest) (*Task, error) {
	if req.Title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if req.Type == "" {
		return nil, fmt.Errorf("type is required")
	}

	// Validate priority
	if req.Priority < 0 || req.Priority > 4 {
		return nil, fmt.Errorf("priority must be between 0 and 4")
	}

	now := time.Now()
	task := &Task{
		ID:          generateTaskID(),
		ParentID:    req.ParentID,
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		Size:        req.Size,
		Status:      TaskStatusOpen,
		Priority:    req.Priority,
		Assignee:    req.Assignee,
		Labels:      req.Labels,
		CreatedAt:   now,
		UpdatedAt:   now,
		Children:    []string{},
		DependsOn:   []string{},
		BlockedBy:   []string{},
		Attempts:    0,
		MaxAttempts: 3, // Default
		Artifacts:   make(map[string]interface{}),
	}

	c.tasks[task.ID] = task
	return task, nil
}

// GetTask retrieves a task by ID
func (c *Client) GetTask(id string) (*Task, error) {
	task, exists := c.tasks[id]
	if !exists {
		return nil, fmt.Errorf("task not found: %s", id)
	}
	return task, nil
}

// UpdateTaskStatus updates the status of a task
func (c *Client) UpdateTaskStatus(id string, status TaskStatus) error {
	task, err := c.GetTask(id)
	if err != nil {
		return err
	}

	task.Status = status
	task.UpdatedAt = time.Now()

	if status == TaskStatusClosed {
		task.ClosedAt = time.Now()
	}

	return nil
}

// AddDependency adds a dependency relationship between tasks
// taskID depends on dependsOnID
func (c *Client) AddDependency(taskID, dependsOnID string) error {
	task, err := c.GetTask(taskID)
	if err != nil {
		return err
	}

	// Check if dependency already exists
	for _, dep := range task.DependsOn {
		if dep == dependsOnID {
			return nil // Already exists
		}
	}

	task.DependsOn = append(task.DependsOn, dependsOnID)
	task.UpdatedAt = time.Now()

	// Update the blocked task
	blockedTask, err := c.GetTask(dependsOnID)
	if err != nil {
		return err
	}

	// Add to BlockedBy if not already present
	found := false
	for _, blocked := range blockedTask.BlockedBy {
		if blocked == taskID {
			found = true
			break
		}
	}
	if !found {
		blockedTask.BlockedBy = append(blockedTask.BlockedBy, taskID)
		blockedTask.UpdatedAt = time.Now()
	}

	return nil
}

// CloseTask marks a task as closed with an optional reason
func (c *Client) CloseTask(id, reason string) error {
	task, err := c.GetTask(id)
	if err != nil {
		return err
	}

	task.Status = TaskStatusClosed
	task.ClosedAt = time.Now()
	task.UpdatedAt = time.Now()

	if reason != "" {
		if task.Notes != "" {
			task.Notes += "\n\nClose reason: " + reason
		} else {
			task.Notes = "Close reason: " + reason
		}
	}

	return nil
}

// ListReadyTasks returns tasks that are open and have no blocking dependencies
func (c *Client) ListReadyTasks() ([]*Task, error) {
	var ready []*Task

	for _, task := range c.tasks {
		if task.Status != TaskStatusOpen {
			continue
		}

		// Check if all dependencies are closed
		isReady := true
		for _, depID := range task.DependsOn {
			dep, err := c.GetTask(depID)
			if err != nil {
				continue
			}
			if dep.Status != TaskStatusClosed {
				isReady = false
				break
			}
		}

		if isReady {
			ready = append(ready, task)
		}
	}

	return ready, nil
}

// UpdateTask updates fields of an existing task
func (c *Client) UpdateTask(id string, req UpdateTaskRequest) error {
	task, err := c.GetTask(id)
	if err != nil {
		return err
	}

	if req.Title != nil {
		task.Title = *req.Title
	}
	if req.Description != nil {
		task.Description = *req.Description
	}
	if req.Notes != nil {
		task.Notes = *req.Notes
	}
	if req.Status != nil {
		task.Status = *req.Status
		if *req.Status == TaskStatusClosed {
			task.ClosedAt = time.Now()
		}
	}
	if req.Priority != nil {
		if *req.Priority < 0 || *req.Priority > 4 {
			return fmt.Errorf("priority must be between 0 and 4")
		}
		task.Priority = *req.Priority
	}
	if req.Size != nil {
		task.Size = *req.Size
	}
	if req.Assignee != nil {
		task.Assignee = *req.Assignee
	}

	task.UpdatedAt = time.Now()
	return nil
}

// generateTaskID creates a unique task identifier
func generateTaskID() string {
	// Generate a UUID-based ID
	// In real beads, this would follow beads-xxx format
	id := uuid.New()
	return fmt.Sprintf("beads-%s", id.String()[:8])
}
