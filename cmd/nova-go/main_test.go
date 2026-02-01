package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestTraceCommand(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()

	// Set up environment
	oldDir := os.Getenv("CLAUDE_PROJECT_DIR")
	os.Setenv("CLAUDE_PROJECT_DIR", tmpDir)
	defer os.Setenv("CLAUDE_PROJECT_DIR", oldDir)

	// Create mock hook input
	hookInput := map[string]interface{}{
		"session_id": "test-session-123",
		"tool_name":  "Read",
		"tool_input": map[string]interface{}{
			"file_path": "/test/file.txt",
		},
		"timestamp": "2024-01-31T10:00:00Z",
	}

	inputJSON, err := json.Marshal(hookInput)
	if err != nil {
		t.Fatalf("Failed to marshal test input: %v", err)
	}

	// Simulate stdin
	oldStdin := os.Stdin
	r, w, _ := os.Pipe()
	os.Stdin = r

	go func() {
		w.Write(inputJSON)
		w.Close()
	}()

	defer func() { os.Stdin = oldStdin }()

	// Run trace command
	cmd := newTraceCommand()
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetErr(&bytes.Buffer{})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("Trace command failed: %v", err)
	}

	// Verify trace file was created
	tracesDir := filepath.Join(tmpDir, ".claude", "traces")
	files, err := os.ReadDir(tracesDir)
	if err != nil {
		t.Fatalf("Failed to read traces directory: %v", err)
	}

	if len(files) == 0 {
		t.Fatal("No trace files were created")
	}

	// Verify trace file contains valid JSON
	traceFile := filepath.Join(tracesDir, files[0].Name())
	data, err := os.ReadFile(traceFile)
	if err != nil {
		t.Fatalf("Failed to read trace file: %v", err)
	}

	var trace map[string]interface{}
	if err := json.Unmarshal(data[:len(data)-1], &trace); err != nil {
		t.Fatalf("Trace file does not contain valid JSON: %v", err)
	}

	// Verify essential fields
	if trace["session_id"] != "test-session-123" {
		t.Errorf("Expected session_id 'test-session-123', got %v", trace["session_id"])
	}

	if trace["trace_id"] == nil {
		t.Error("Expected trace_id to be set")
	}

	if trace["span_id"] == nil {
		t.Error("Expected span_id to be set")
	}
}

func TestRootCommand(t *testing.T) {
	// Test that root command shows help when no subcommand is provided
	cmd := newRootCommand()
	buf := &bytes.Buffer{}
	cmd.SetOut(buf)
	cmd.SetErr(buf)
	cmd.SetArgs([]string{"--help"})

	if err := cmd.Execute(); err != nil {
		t.Fatalf("Root command failed: %v", err)
	}

	output := buf.String()
	if len(output) == 0 {
		t.Error("Expected help output, got empty string")
	}
}
