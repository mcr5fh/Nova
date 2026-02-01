package trace

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Writer writes trace events to an append-only JSONL file
type Writer struct {
	runID     string
	traceFile *os.File
	mu        sync.Mutex
	closed    bool
}

// NewWriter creates a new trace writer for the given run
func NewWriter(baseDir, runID string) (*Writer, error) {
	// Create the runs directory structure
	runDir := filepath.Join(baseDir, "runs", runID)
	if err := os.MkdirAll(runDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create run directory: %w", err)
	}

	// Open the trace file in append mode
	traceFile := filepath.Join(runDir, "trace.jsonl")
	f, err := os.OpenFile(traceFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open trace file: %w", err)
	}

	return &Writer{
		runID:     runID,
		traceFile: f,
	}, nil
}

// WriteEvent writes a trace event to the JSONL file
func (w *Writer) WriteEvent(event *Event) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return fmt.Errorf("writer is closed")
	}

	// Marshal the event to JSON
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Write the JSON line with a newline
	if _, err := w.traceFile.Write(append(data, '\n')); err != nil {
		return fmt.Errorf("failed to write event: %w", err)
	}

	// Sync to ensure the event is written to disk
	if err := w.traceFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync trace file: %w", err)
	}

	return nil
}

// Close closes the trace writer
func (w *Writer) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.closed {
		return nil
	}

	w.closed = true
	return w.traceFile.Close()
}

// RunID returns the run ID for this writer
func (w *Writer) RunID() string {
	return w.runID
}
