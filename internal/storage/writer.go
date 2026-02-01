package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Writer handles appending trace data to per-session JSONL files
type Writer struct {
	traceDir  string
	sessionID string // Track which session this writer is for
	file      *os.File
	mu        sync.Mutex
}

// NewWriter creates a new trace writer that writes to the specified directory for a given session
func NewWriter(traceDir string, sessionID string) (*Writer, error) {
	// Create directory if it doesn't exist
	if err := os.MkdirAll(traceDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create trace directory: %w", err)
	}

	w := &Writer{
		traceDir:  traceDir,
		sessionID: sessionID,
	}

	return w, nil
}

// Write appends a trace entry to the session's JSONL file
func (w *Writer) Write(data interface{}) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Open file if not already open
	if w.file == nil {
		if err := w.openSessionFile(); err != nil {
			return fmt.Errorf("failed to open session file: %w", err)
		}
	}

	// Encode and write the JSON line
	encoder := json.NewEncoder(w.file)
	if err := encoder.Encode(data); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
}

// openSessionFile opens the session-specific trace file
func (w *Writer) openSessionFile() error {
	// Session file: session-{epoch}-{uuid}.jsonl
	epoch := time.Now().Unix()
	filename := fmt.Sprintf("session-%d-%s.jsonl", epoch, w.sessionID)
	filePath := filepath.Join(w.traceDir, filename)

	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open trace file: %w", err)
	}

	w.file = file

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
