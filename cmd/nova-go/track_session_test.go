package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestTrackSession(t *testing.T) {
	// Create a temporary directory for test output and change to it
	// so GetTraceDir() uses the fallback path (not in git repo)
	homeDir := t.TempDir()
	tempWorkDir := t.TempDir()

	// Override home directory for this test
	originalHome := os.Getenv("HOME")
	os.Setenv("HOME", homeDir)
	defer os.Setenv("HOME", originalHome)

	// Change to non-git directory
	originalDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tempWorkDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(originalDir)

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

	// Verify output file was created (using fallback path since not in git repo)
	registryPath := filepath.Join(homeDir, ".nova", "local", "default", "traces", "sessions.jsonl")
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
