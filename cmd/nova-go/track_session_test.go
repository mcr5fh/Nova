package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestTrackSession(t *testing.T) {
	// Create a temporary directory for test output
	homeDir := t.TempDir()

	// Override home directory for this test
	originalHome := os.Getenv("HOME")
	os.Setenv("HOME", homeDir)
	defer os.Setenv("HOME", originalHome)

	// Set test mode to skip watcher spawning
	os.Setenv("NOVA_TEST_MODE", "1")
	defer os.Unsetenv("NOVA_TEST_MODE")

	// Create test input
	input := map[string]interface{}{
		"session_id":      "test-session-123",
		"transcript_path": "/tmp/test-transcript.jsonl",
		"source":          "startup",
	}

	inputJSON, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("failed to marshal input: %v", err)
	}

	// Set up stdin
	oldStdin := os.Stdin
	r, w, _ := os.Pipe()
	os.Stdin = r
	defer func() { os.Stdin = oldStdin }()

	// Write input to pipe
	go func() {
		w.Write(inputJSON)
		w.Close()
	}()

	// Run the command
	cmd := newTrackSessionCommand()
	if err := cmd.Execute(); err != nil {
		t.Fatalf("command failed: %v", err)
	}

	// Verify output file was created
	registryPath := filepath.Join(homeDir, ".claude", "traces", "sessions.jsonl")
	if _, err := os.Stat(registryPath); os.IsNotExist(err) {
		t.Fatalf("sessions.jsonl was not created at %s", registryPath)
	}

	// Read and verify the session entry
	data, err := os.ReadFile(registryPath)
	if err != nil {
		t.Fatalf("failed to read sessions.jsonl: %v", err)
	}

	var entry map[string]interface{}
	if err := json.Unmarshal(bytes.TrimSpace(data), &entry); err != nil {
		t.Fatalf("failed to parse session entry: %v", err)
	}

	// Verify fields
	if entry["session_id"] != "test-session-123" {
		t.Errorf("session_id = %q, want %q", entry["session_id"], "test-session-123")
	}
	if entry["transcript_path"] != "/tmp/test-transcript.jsonl" {
		t.Errorf("transcript_path = %q, want %q", entry["transcript_path"], "/tmp/test-transcript.jsonl")
	}
	if entry["source"] != "startup" {
		t.Errorf("source = %q, want %q", entry["source"], "startup")
	}
	if entry["started_at"] == nil || entry["started_at"] == "" {
		t.Error("started_at is missing or empty")
	}
}

func TestTrackSessionMissingFields(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
	}{
		{
			name:  "missing session_id",
			input: map[string]interface{}{"transcript_path": "/tmp/test.jsonl"},
		},
		{
			name:  "missing transcript_path",
			input: map[string]interface{}{"session_id": "test123"},
		},
		{
			name:  "empty fields",
			input: map[string]interface{}{"session_id": "", "transcript_path": ""},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set test mode
			os.Setenv("NOVA_TEST_MODE", "1")
			defer os.Unsetenv("NOVA_TEST_MODE")

			inputJSON, err := json.Marshal(tt.input)
			if err != nil {
				t.Fatalf("failed to marshal input: %v", err)
			}

			// Set up stdin
			oldStdin := os.Stdin
			r, w, _ := os.Pipe()
			os.Stdin = r
			defer func() { os.Stdin = oldStdin }()

			// Write input to pipe
			go func() {
				w.Write(inputJSON)
				w.Close()
			}()

			// Run the command - should return error
			cmd := newTrackSessionCommand()
			err = cmd.Execute()
			if err == nil {
				t.Error("expected error for missing required fields, got nil")
			}
		})
	}
}
