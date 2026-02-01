package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/mattruiters/nova/internal/storage"
	"github.com/mattruiters/nova/internal/transcript"
	"github.com/spf13/cobra"
)

func newProcessTranscriptCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "process-transcript",
		Short: "Handle SessionEnd hook - parse transcript and generate traces",
		RunE:  runProcessTranscript,
	}
}

func runProcessTranscript(cmd *cobra.Command, args []string) error {
	// Read hook input from stdin
	var input map[string]interface{}
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		return fmt.Errorf("parse stdin: %w", err)
	}

	sessionID, _ := input["session_id"].(string)
	transcriptPath, _ := input["transcript_path"].(string)

	if sessionID == "" || transcriptPath == "" {
		return fmt.Errorf("missing required fields: session_id=%q, transcript_path=%q", sessionID, transcriptPath)
	}

	// Parse transcript and generate traces
	parser := transcript.NewParser()
	traces, err := parser.Parse(transcriptPath, sessionID)
	if err != nil {
		return fmt.Errorf("parse transcript: %w", err)
	}

	// Write traces to storage
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home dir: %w", err)
	}
	tracesDir := filepath.Join(homeDir, ".claude", "traces")

	writer, err := storage.NewWriter(tracesDir)
	if err != nil {
		return fmt.Errorf("create writer: %w", err)
	}
	defer func() { _ = writer.Close() }()

	for _, trace := range traces {
		// Convert TraceEvent to map for storage writer
		traceMap := map[string]interface{}{
			"session_id": trace.SessionID,
			"trace_id":   trace.TraceID,
			"span_id":    trace.SpanID,
			"timestamp":  trace.Timestamp,
			"event_type": trace.EventType,
			"tool_name":  trace.ToolName,
			"metrics": map[string]interface{}{
				"input_tokens":                trace.Metrics.InputTokens,
				"output_tokens":               trace.Metrics.OutputTokens,
				"cache_creation_input_tokens": trace.Metrics.CacheCreationInputTokens,
				"cache_read_input_tokens":     trace.Metrics.CacheReadInputTokens,
				"cost_usd":                    trace.Metrics.CostUSD,
			},
			"tags": trace.Tags,
		}

		if len(trace.ToolInput) > 0 {
			traceMap["tool_input"] = trace.ToolInput
		}

		if err := writer.Write(traceMap); err != nil {
			fmt.Fprintf(os.Stderr, "write trace error: %v\n", err)
		}
	}

	// Update sessions registry with end time
	if err := updateSessionEndTime(sessionID); err != nil {
		fmt.Fprintf(os.Stderr, "update session end time error: %v\n", err)
	}

	fmt.Fprintf(os.Stderr, "Generated %d traces from session %s\n", len(traces), sessionID)

	return nil
}

func updateSessionEndTime(sessionID string) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home dir: %w", err)
	}
	registryPath := filepath.Join(homeDir, ".claude", "traces", "sessions.jsonl")

	// Append a session update entry
	file, err := os.OpenFile(registryPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open registry: %w", err)
	}
	defer file.Close()

	entry := map[string]interface{}{
		"session_id": sessionID,
		"ended_at":   time.Now().Format(time.RFC3339),
	}

	if err := json.NewEncoder(file).Encode(entry); err != nil {
		return fmt.Errorf("write entry: %w", err)
	}

	return nil
}
