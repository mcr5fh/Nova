package storage

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWriter_Write(t *testing.T) {
	// Create temp directory for testing
	tmpDir := t.TempDir()
	sessionID := "test-session-123"

	// Create writer with custom trace directory
	writer, err := NewWriter(tmpDir, sessionID)
	if err != nil {
		t.Fatalf("Failed to create writer: %v", err)
	}
	defer writer.Close()

	// Write a test trace entry
	testData := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"event":     "test_event",
		"data":      "test_data",
	}

	if err := writer.Write(testData); err != nil {
		t.Fatalf("Failed to write trace: %v", err)
	}

	// Verify file was created with session ID (pattern: session-{epoch}-{uuid}.jsonl)
	files, err := filepath.Glob(filepath.Join(tmpDir, "session-*-"+sessionID+".jsonl"))
	if err != nil {
		t.Fatalf("Failed to glob files: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("Expected 1 file, found %d", len(files))
	}

	expectedFile := files[0]

	// Verify content
	content, err := os.ReadFile(expectedFile)
	if err != nil {
		t.Fatalf("Failed to read file: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(content, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	if decoded["event"] != "test_event" {
		t.Errorf("Expected event=test_event, got %v", decoded["event"])
	}
}

func TestWriter_CreateDirectoryIfMissing(t *testing.T) {
	// Use a nested path that doesn't exist
	tmpBase := t.TempDir()
	traceDir := filepath.Join(tmpBase, "nested", "traces")

	// Directory should not exist yet
	if _, err := os.Stat(traceDir); !os.IsNotExist(err) {
		t.Fatalf("Directory should not exist yet")
	}

	// Create writer - should create the directory
	writer, err := NewWriter(traceDir, "test-session")
	if err != nil {
		t.Fatalf("Failed to create writer: %v", err)
	}
	defer writer.Close()

	// Verify directory was created
	if _, err := os.Stat(traceDir); os.IsNotExist(err) {
		t.Fatalf("Directory was not created")
	}
}

// TestWriter_DailyRotation removed - no longer relevant with per-session files

func TestWriter_MultipleEntries(t *testing.T) {
	tmpDir := t.TempDir()
	sessionID := "test-session-multi"

	writer, err := NewWriter(tmpDir, sessionID)
	if err != nil {
		t.Fatalf("Failed to create writer: %v", err)
	}
	defer writer.Close()

	// Write multiple entries
	for i := 0; i < 3; i++ {
		data := map[string]interface{}{"index": i}
		if err := writer.Write(data); err != nil {
			t.Fatalf("Failed to write entry %d: %v", i, err)
		}
	}

	// Read and verify all entries (pattern: session-{epoch}-{uuid}.jsonl)
	files, err := filepath.Glob(filepath.Join(tmpDir, "session-*-"+sessionID+".jsonl"))
	if err != nil {
		t.Fatalf("Failed to glob files: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("Expected 1 file, found %d", len(files))
	}

	content, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatalf("Failed to read file: %v", err)
	}

	lines := 0
	decoder := json.NewDecoder(bytes.NewReader(content))
	for decoder.More() {
		var entry map[string]interface{}
		if err := decoder.Decode(&entry); err != nil {
			t.Fatalf("Failed to decode entry: %v", err)
		}
		lines++
	}

	if lines != 3 {
		t.Errorf("Expected 3 lines, got %d", lines)
	}
}

func TestWriter_SessionIsolation(t *testing.T) {
	tmpDir := t.TempDir()

	// Create two writers for different sessions
	session1 := "session-aaa"
	session2 := "session-bbb"

	writer1, err := NewWriter(tmpDir, session1)
	if err != nil {
		t.Fatalf("Failed to create writer1: %v", err)
	}
	defer writer1.Close()

	writer2, err := NewWriter(tmpDir, session2)
	if err != nil {
		t.Fatalf("Failed to create writer2: %v", err)
	}
	defer writer2.Close()

	// Write to both sessions
	if err := writer1.Write(map[string]interface{}{"session": 1}); err != nil {
		t.Fatalf("Failed to write to session1: %v", err)
	}

	if err := writer2.Write(map[string]interface{}{"session": 2}); err != nil {
		t.Fatalf("Failed to write to session2: %v", err)
	}

	// Verify separate files exist (pattern: session-{epoch}-{uuid}.jsonl)
	files1, err := filepath.Glob(filepath.Join(tmpDir, "session-*-"+session1+".jsonl"))
	if err != nil {
		t.Fatalf("Failed to glob session1 files: %v", err)
	}
	if len(files1) != 1 {
		t.Fatalf("Session 1 file does not exist")
	}

	files2, err := filepath.Glob(filepath.Join(tmpDir, "session-*-"+session2+".jsonl"))
	if err != nil {
		t.Fatalf("Failed to glob session2 files: %v", err)
	}
	if len(files2) != 1 {
		t.Fatalf("Session 2 file does not exist")
	}

	// Verify files are different
	content1, _ := os.ReadFile(files1[0])
	content2, _ := os.ReadFile(files2[0])

	if string(content1) == string(content2) {
		t.Error("Session files should contain different data")
	}
}
