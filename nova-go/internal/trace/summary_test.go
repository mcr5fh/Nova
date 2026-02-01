package trace

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewRunSummary(t *testing.T) {
	runID := "test-run-123"
	rootTaskID := "task-root"
	specFile := "spec.md"

	summary := NewRunSummary(runID, rootTaskID, specFile)

	if summary.RunID != runID {
		t.Errorf("expected run ID %s, got %s", runID, summary.RunID)
	}

	if summary.RootTaskID != rootTaskID {
		t.Errorf("expected root task ID %s, got %s", rootTaskID, summary.RootTaskID)
	}

	if summary.SpecFile != specFile {
		t.Errorf("expected spec file %s, got %s", specFile, summary.SpecFile)
	}

	if summary.Status != RunStatusRunning {
		t.Errorf("expected status %s, got %s", RunStatusRunning, summary.Status)
	}

	if summary.StartTime.IsZero() {
		t.Error("expected non-zero start time")
	}

	if summary.TasksTotal != 0 {
		t.Errorf("expected tasks total 0, got %d", summary.TasksTotal)
	}

	if summary.TasksCompleted != 0 {
		t.Errorf("expected tasks completed 0, got %d", summary.TasksCompleted)
	}

	if summary.TasksFailed != 0 {
		t.Errorf("expected tasks failed 0, got %d", summary.TasksFailed)
	}
}

func TestRunSummary_MarkCompleted(t *testing.T) {
	summary := NewRunSummary("run-1", "task-1", "spec.md")

	// Wait a bit to ensure duration is > 0
	time.Sleep(10 * time.Millisecond)

	summary.MarkCompleted(true)

	if summary.Status != RunStatusCompleted {
		t.Errorf("expected status %s, got %s", RunStatusCompleted, summary.Status)
	}

	if summary.EndTime.IsZero() {
		t.Error("expected non-zero end time")
	}

	if summary.DurationMs <= 0 {
		t.Errorf("expected positive duration, got %d", summary.DurationMs)
	}

	if !summary.Success {
		t.Error("expected success to be true")
	}
}

func TestRunSummary_MarkFailed(t *testing.T) {
	summary := NewRunSummary("run-2", "task-2", "spec.md")
	errorMsg := "Task execution failed"

	summary.MarkFailed(errorMsg)

	if summary.Status != RunStatusFailed {
		t.Errorf("expected status %s, got %s", RunStatusFailed, summary.Status)
	}

	if summary.EndTime.IsZero() {
		t.Error("expected non-zero end time")
	}

	if summary.Success {
		t.Error("expected success to be false")
	}

	if summary.ErrorMessage != errorMsg {
		t.Errorf("expected error message '%s', got '%s'", errorMsg, summary.ErrorMessage)
	}
}

func TestRunSummary_IncrementTasksTotal(t *testing.T) {
	summary := NewRunSummary("run-3", "task-3", "spec.md")

	summary.IncrementTasksTotal()
	if summary.TasksTotal != 1 {
		t.Errorf("expected tasks total 1, got %d", summary.TasksTotal)
	}

	summary.IncrementTasksTotal()
	summary.IncrementTasksTotal()
	if summary.TasksTotal != 3 {
		t.Errorf("expected tasks total 3, got %d", summary.TasksTotal)
	}
}

func TestRunSummary_IncrementTasksCompleted(t *testing.T) {
	summary := NewRunSummary("run-4", "task-4", "spec.md")

	summary.IncrementTasksCompleted()
	if summary.TasksCompleted != 1 {
		t.Errorf("expected tasks completed 1, got %d", summary.TasksCompleted)
	}

	summary.IncrementTasksCompleted()
	if summary.TasksCompleted != 2 {
		t.Errorf("expected tasks completed 2, got %d", summary.TasksCompleted)
	}
}

func TestRunSummary_IncrementTasksFailed(t *testing.T) {
	summary := NewRunSummary("run-5", "task-5", "spec.md")

	summary.IncrementTasksFailed()
	if summary.TasksFailed != 1 {
		t.Errorf("expected tasks failed 1, got %d", summary.TasksFailed)
	}

	summary.IncrementTasksFailed()
	summary.IncrementTasksFailed()
	if summary.TasksFailed != 3 {
		t.Errorf("expected tasks failed 3, got %d", summary.TasksFailed)
	}
}

func TestWriteSummary(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-summary-1"

	summary := NewRunSummary(runID, "task-root", "spec.md")
	summary.IncrementTasksTotal()
	summary.IncrementTasksTotal()
	summary.IncrementTasksCompleted()
	summary.MarkCompleted(true)

	if err := WriteSummary(tempDir, summary); err != nil {
		t.Fatalf("failed to write summary: %v", err)
	}

	// Read the summary file
	summaryFile := filepath.Join(tempDir, "runs", runID, "run.json")
	content, err := os.ReadFile(summaryFile)
	if err != nil {
		t.Fatalf("failed to read summary file: %v", err)
	}

	// Unmarshal and verify
	var readSummary RunSummary
	if err := json.Unmarshal(content, &readSummary); err != nil {
		t.Fatalf("failed to unmarshal summary: %v", err)
	}

	if readSummary.RunID != runID {
		t.Errorf("expected run ID %s, got %s", runID, readSummary.RunID)
	}

	if readSummary.TasksTotal != 2 {
		t.Errorf("expected tasks total 2, got %d", readSummary.TasksTotal)
	}

	if readSummary.TasksCompleted != 1 {
		t.Errorf("expected tasks completed 1, got %d", readSummary.TasksCompleted)
	}

	if readSummary.Status != RunStatusCompleted {
		t.Errorf("expected status %s, got %s", RunStatusCompleted, readSummary.Status)
	}

	if !readSummary.Success {
		t.Error("expected success to be true")
	}
}

func TestWriteSummaryOverwrite(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-summary-2"

	// Write first summary
	summary1 := NewRunSummary(runID, "task-root", "spec.md")
	summary1.IncrementTasksTotal()
	if err := WriteSummary(tempDir, summary1); err != nil {
		t.Fatalf("failed to write first summary: %v", err)
	}

	// Write second summary (should overwrite)
	summary2 := NewRunSummary(runID, "task-root", "spec.md")
	summary2.IncrementTasksTotal()
	summary2.IncrementTasksTotal()
	summary2.IncrementTasksCompleted()
	summary2.MarkCompleted(true)
	if err := WriteSummary(tempDir, summary2); err != nil {
		t.Fatalf("failed to write second summary: %v", err)
	}

	// Read and verify the second summary was written
	summaryFile := filepath.Join(tempDir, "runs", runID, "run.json")
	content, err := os.ReadFile(summaryFile)
	if err != nil {
		t.Fatalf("failed to read summary file: %v", err)
	}

	var readSummary RunSummary
	if err := json.Unmarshal(content, &readSummary); err != nil {
		t.Fatalf("failed to unmarshal summary: %v", err)
	}

	if readSummary.TasksTotal != 2 {
		t.Errorf("expected tasks total 2 (from second summary), got %d", readSummary.TasksTotal)
	}

	if readSummary.Status != RunStatusCompleted {
		t.Errorf("expected status %s, got %s", RunStatusCompleted, readSummary.Status)
	}
}
