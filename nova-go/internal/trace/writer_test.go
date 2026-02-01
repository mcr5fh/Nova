package trace

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNewWriter(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-123"

	writer, err := NewWriter(tempDir, runID)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}
	defer writer.Close()

	if writer.runID != runID {
		t.Errorf("expected run ID %s, got %s", runID, writer.runID)
	}

	// Check that the run directory was created
	runDir := filepath.Join(tempDir, "runs", runID)
	if _, err := os.Stat(runDir); os.IsNotExist(err) {
		t.Errorf("run directory was not created: %s", runDir)
	}

	// Check that trace file was created
	traceFile := filepath.Join(runDir, "trace.jsonl")
	if _, err := os.Stat(traceFile); os.IsNotExist(err) {
		t.Errorf("trace file was not created: %s", traceFile)
	}
}

func TestWriteEvent(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-456"

	writer, err := NewWriter(tempDir, runID)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}
	defer writer.Close()

	// Write an event
	event := NewTaskStartedEvent("task-1", 0)
	if err := writer.WriteEvent(event); err != nil {
		t.Fatalf("failed to write event: %v", err)
	}

	// Read the trace file and verify the event was written
	traceFile := filepath.Join(tempDir, "runs", runID, "trace.jsonl")
	content, err := os.ReadFile(traceFile)
	if err != nil {
		t.Fatalf("failed to read trace file: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected 1 line in trace file, got %d", len(lines))
	}

	var readEvent Event
	if err := json.Unmarshal([]byte(lines[0]), &readEvent); err != nil {
		t.Fatalf("failed to unmarshal event: %v", err)
	}

	if readEvent.EventType != EventTypeTaskStarted {
		t.Errorf("expected event type %s, got %s", EventTypeTaskStarted, readEvent.EventType)
	}

	if readEvent.TaskID != "task-1" {
		t.Errorf("expected task ID task-1, got %s", readEvent.TaskID)
	}
}

func TestWriteMultipleEvents(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-789"

	writer, err := NewWriter(tempDir, runID)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}
	defer writer.Close()

	// Write multiple events
	events := []*Event{
		NewTaskStartedEvent("task-1", 0),
		NewPlanningStartedEvent("task-1"),
		NewPlanningCompletedEvent("task-1", "L", true, 3),
	}

	for _, event := range events {
		if err := writer.WriteEvent(event); err != nil {
			t.Fatalf("failed to write event: %v", err)
		}
	}

	// Read and verify all events
	traceFile := filepath.Join(tempDir, "runs", runID, "trace.jsonl")
	content, err := os.ReadFile(traceFile)
	if err != nil {
		t.Fatalf("failed to read trace file: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) != 3 {
		t.Fatalf("expected 3 lines in trace file, got %d", len(lines))
	}

	// Verify first event
	var event1 Event
	if err := json.Unmarshal([]byte(lines[0]), &event1); err != nil {
		t.Fatalf("failed to unmarshal event 1: %v", err)
	}
	if event1.EventType != EventTypeTaskStarted {
		t.Errorf("expected event 1 type %s, got %s", EventTypeTaskStarted, event1.EventType)
	}

	// Verify second event
	var event2 Event
	if err := json.Unmarshal([]byte(lines[1]), &event2); err != nil {
		t.Fatalf("failed to unmarshal event 2: %v", err)
	}
	if event2.EventType != EventTypePlanningStarted {
		t.Errorf("expected event 2 type %s, got %s", EventTypePlanningStarted, event2.EventType)
	}

	// Verify third event
	var event3 Event
	if err := json.Unmarshal([]byte(lines[2]), &event3); err != nil {
		t.Fatalf("failed to unmarshal event 3: %v", err)
	}
	if event3.EventType != EventTypePlanningCompleted {
		t.Errorf("expected event 3 type %s, got %s", EventTypePlanningCompleted, event3.EventType)
	}
	if event3.Size != "L" {
		t.Errorf("expected size L, got %s", event3.Size)
	}
	if event3.SubtaskCount != 3 {
		t.Errorf("expected 3 subtasks, got %d", event3.SubtaskCount)
	}
}

func TestWriteEventAfterClose(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-closed"

	writer, err := NewWriter(tempDir, runID)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}

	writer.Close()

	// Try to write an event after closing
	event := NewTaskStartedEvent("task-1", 0)
	err = writer.WriteEvent(event)
	if err == nil {
		t.Error("expected error when writing event after close, got nil")
	}
}

func TestConcurrentWrites(t *testing.T) {
	tempDir := t.TempDir()
	runID := "test-run-concurrent"

	writer, err := NewWriter(tempDir, runID)
	if err != nil {
		t.Fatalf("failed to create writer: %v", err)
	}
	defer writer.Close()

	// Write events concurrently
	const numGoroutines = 10
	const eventsPerGoroutine = 5

	done := make(chan bool, numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			for j := 0; j < eventsPerGoroutine; j++ {
				taskID := "task-" + string(rune('A'+id))
				event := NewTaskStartedEvent(taskID, j)
				if err := writer.WriteEvent(event); err != nil {
					t.Errorf("goroutine %d failed to write event: %v", id, err)
				}
				time.Sleep(1 * time.Millisecond) // Small delay to increase chance of interleaving
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines to finish
	for i := 0; i < numGoroutines; i++ {
		<-done
	}

	// Verify that all events were written
	traceFile := filepath.Join(tempDir, "runs", runID, "trace.jsonl")
	content, err := os.ReadFile(traceFile)
	if err != nil {
		t.Fatalf("failed to read trace file: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	expectedLines := numGoroutines * eventsPerGoroutine
	if len(lines) != expectedLines {
		t.Errorf("expected %d lines in trace file, got %d", expectedLines, len(lines))
	}

	// Verify all lines are valid JSON
	for i, line := range lines {
		var event Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			t.Errorf("line %d is not valid JSON: %v", i, err)
		}
	}
}
