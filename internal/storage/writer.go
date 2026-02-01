package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Writer handles appending trace data to daily JSONL files
type Writer struct {
	traceDir    string
	currentDate string
	file        *os.File
	mu          sync.Mutex
}

// NewWriter creates a new trace writer that writes to the specified directory
func NewWriter(traceDir string) (*Writer, error) {
	// Create directory if it doesn't exist
	if err := os.MkdirAll(traceDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create trace directory: %w", err)
	}

	w := &Writer{
		traceDir: traceDir,
	}

	return w, nil
}

// Write appends a trace entry to the current day's JSONL file
func (w *Writer) Write(data interface{}) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	today := time.Now().Format("2006-01-02")

	// Check if we need to rotate to a new file
	if w.file == nil || w.currentDate != today {
		if err := w.rotateFile(today); err != nil {
			return fmt.Errorf("failed to rotate file: %w", err)
		}
	}

	// Encode and write the JSON line
	encoder := json.NewEncoder(w.file)
	if err := encoder.Encode(data); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
}

// rotateFile closes the current file (if any) and opens a new file for the given date
func (w *Writer) rotateFile(date string) error {
	// Close existing file if open
	if w.file != nil {
		if err := w.file.Close(); err != nil {
			return fmt.Errorf("failed to close existing file: %w", err)
		}
	}

	// Open new file for today
	filename := fmt.Sprintf("traces-%s.jsonl", date)
	filePath := filepath.Join(w.traceDir, filename)

	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open trace file: %w", err)
	}

	w.file = file
	w.currentDate = date

	return nil
}

// Close closes the writer and any open files
func (w *Writer) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.file != nil {
		return w.file.Close()
	}

	return nil
}
