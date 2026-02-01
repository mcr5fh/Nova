package main

import (
	"bytes"
	"testing"
)

// TestTraceCommand removed - old per-tool hook architecture has been replaced
// by session-based transcript parsing. See track-session and process-transcript
// tests in track_session_test.go and process_transcript_test.go

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
