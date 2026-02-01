package trace

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// RunStatus represents the status of a run
type RunStatus string

const (
	RunStatusRunning   RunStatus = "running"
	RunStatusCompleted RunStatus = "completed"
	RunStatusFailed    RunStatus = "failed"
)

// RunSummary represents a summary of a task orchestration run
type RunSummary struct {
	RunID      string    `json:"run_id"`
	RootTaskID string    `json:"root_task_id"`
	SpecFile   string    `json:"spec_file"`
	Status     RunStatus `json:"status"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time,omitempty"`
	DurationMs int64     `json:"duration_ms,omitempty"`

	TasksTotal     int `json:"tasks_total"`
	TasksCompleted int `json:"tasks_completed"`
	TasksFailed    int `json:"tasks_failed"`

	Success      bool   `json:"success"`
	ErrorMessage string `json:"error_message,omitempty"`

	mu sync.Mutex `json:"-"`
}

// NewRunSummary creates a new run summary
func NewRunSummary(runID, rootTaskID, specFile string) *RunSummary {
	return &RunSummary{
		RunID:      runID,
		RootTaskID: rootTaskID,
		SpecFile:   specFile,
		Status:     RunStatusRunning,
		StartTime:  time.Now(),
	}
}

// MarkCompleted marks the run as completed
func (s *RunSummary) MarkCompleted(success bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Status = RunStatusCompleted
	s.EndTime = time.Now()
	s.DurationMs = s.EndTime.Sub(s.StartTime).Milliseconds()
	s.Success = success
}

// MarkFailed marks the run as failed
func (s *RunSummary) MarkFailed(errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Status = RunStatusFailed
	s.EndTime = time.Now()
	s.DurationMs = s.EndTime.Sub(s.StartTime).Milliseconds()
	s.Success = false
	s.ErrorMessage = errorMsg
}

// IncrementTasksTotal increments the total task count
func (s *RunSummary) IncrementTasksTotal() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TasksTotal++
}

// IncrementTasksCompleted increments the completed task count
func (s *RunSummary) IncrementTasksCompleted() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TasksCompleted++
}

// IncrementTasksFailed increments the failed task count
func (s *RunSummary) IncrementTasksFailed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TasksFailed++
}

// WriteSummary writes the run summary to run.json
func WriteSummary(baseDir string, summary *RunSummary) error {
	runDir := filepath.Join(baseDir, "runs", summary.RunID)
	if err := os.MkdirAll(runDir, 0755); err != nil {
		return fmt.Errorf("failed to create run directory: %w", err)
	}

	summaryFile := filepath.Join(runDir, "run.json")
	data, err := json.MarshalIndent(summary, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal summary: %w", err)
	}

	if err := os.WriteFile(summaryFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write summary file: %w", err)
	}

	return nil
}
