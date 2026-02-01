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

	// Create writer with custom trace directory
	writer, err := NewWriter(tmpDir)
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

	// Verify file was created with today's date
	today := time.Now().Format("2006-01-02")
	expectedFile := filepath.Join(tmpDir, "traces-"+today+".jsonl")

	if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
		t.Fatalf("Expected file %s does not exist", expectedFile)
	}

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
	writer, err := NewWriter(traceDir)
	if err != nil {
		t.Fatalf("Failed to create writer: %v", err)
	}
	defer writer.Close()

	// Verify directory was created
	if _, err := os.Stat(traceDir); os.IsNotExist(err) {
		t.Fatalf("Directory was not created")
	}
}

func TestWriter_DailyRotation(t *testing.T) {
	tmpDir := t.TempDir()

	writer, err := NewWriter(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create writer: %v", err)
	}
	defer writer.Close()

	// Write first entry
	testData1 := map[string]interface{}{"entry": 1}
	if err := writer.Write(testData1); err != nil {
		t.Fatalf("Failed to write first entry: %v", err)
	}

	// Verify current file exists
	today := time.Now().Format("2006-01-02")
	currentFile := filepath.Join(tmpDir, "traces-"+today+".jsonl")

	info1, err := os.Stat(currentFile)
	if err != nil {
		t.Fatalf("Failed to stat current file: %v", err)
	}

	// Write second entry
	testData2 := map[string]interface{}{"entry": 2}
	if err := writer.Write(testData2); err != nil {
		t.Fatalf("Failed to write second entry: %v", err)
	}

	// Verify file was appended (size increased)
	info2, err := os.Stat(currentFile)
	if err != nil {
		t.Fatalf("Failed to stat current file after second write: %v", err)
	}

	if info2.Size() <= info1.Size() {
		t.Errorf("File should have grown after second write")
	}
}

func TestWriter_MultipleEntries(t *testing.T) {
	tmpDir := t.TempDir()

	writer, err := NewWriter(tmpDir)
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

	// Read and verify all entries
	today := time.Now().Format("2006-01-02")
	filePath := filepath.Join(tmpDir, "traces-"+today+".jsonl")

	content, err := os.ReadFile(filePath)
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
