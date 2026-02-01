package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
)

func newTrackSessionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "track-session",
		Short: "Handle SessionStart hook - log session metadata",
		RunE:  runTrackSession,
	}
}

func runTrackSession(cmd *cobra.Command, args []string) error {
	// Read hook input from stdin
	var input map[string]interface{}
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		return fmt.Errorf("parse stdin: %w", err)
	}

	// Extract session metadata
	sessionID, _ := input["session_id"].(string)
	transcriptPath, _ := input["transcript_path"].(string)
	source, _ := input["source"].(string) // "startup", "resume", etc.

	if sessionID == "" || transcriptPath == "" {
		return fmt.Errorf("missing required fields: session_id=%q, transcript_path=%q", sessionID, transcriptPath)
	}

	// Create session entry
	entry := map[string]interface{}{
		"session_id":      sessionID,
		"transcript_path": transcriptPath,
		"source":          source,
		"started_at":      time.Now().Format(time.RFC3339),
	}

	// Write to sessions registry
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home dir: %w", err)
	}
	registryPath := filepath.Join(homeDir, ".claude", "traces", "sessions.jsonl")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(registryPath), 0755); err != nil {
		return fmt.Errorf("create traces directory: %w", err)
	}

	// Append to registry
	file, err := os.OpenFile(registryPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open registry: %w", err)
	}
	defer file.Close()

	if err := json.NewEncoder(file).Encode(entry); err != nil {
		return fmt.Errorf("write entry: %w", err)
	}

	return nil
}
