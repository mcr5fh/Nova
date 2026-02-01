package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/mattruiters/nova/internal/paths"
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
	reason, _ := input["reason"].(string)

	if sessionID == "" || transcriptPath == "" {
		return fmt.Errorf("missing required fields: session_id=%q, transcript_path=%q", sessionID, transcriptPath)
	}

	// Only process human sessions
	if reason != "prompt_input_exit" {
		fmt.Fprintf(os.Stderr, "Skipping automated session %s (reason=%s)\n", sessionID, reason)
		return nil
	}

	// Parse transcript and generate traces
	parser := transcript.NewParser()
	traces, err := parser.Parse(transcriptPath, sessionID)
	if err != nil {
		return fmt.Errorf("parse transcript: %w", err)
	}

	// Calculate session duration from traces
	var startedAt, endedAt time.Time
	var duration int
	if len(traces) > 0 {
		var err error
		startedAt, err = time.Parse(time.RFC3339, traces[0].Timestamp)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to parse start timestamp: %v\n", err)
		}
		endedAt, err = time.Parse(time.RFC3339, traces[len(traces)-1].Timestamp)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to parse end timestamp: %v\n", err)
		}
		if !startedAt.IsZero() && !endedAt.IsZero() {
			duration = int(endedAt.Sub(startedAt).Seconds())
		}
	}

	// Write traces to storage
	tracesDir, err := paths.GetTraceDir()
	if err != nil {
		return fmt.Errorf("get trace dir: %w", err)
	}

	writer, err := storage.NewWriter(tracesDir, sessionID)
	if err != nil {
		return fmt.Errorf("create writer: %w", err)
	}
	defer func() { _ = writer.Close() }()

	// Write session metadata as first line
	metadata := map[string]interface{}{
		"session_id":       sessionID,
		"user_type":        "human",
		"duration_seconds": duration,
		"started_at":       startedAt.Format(time.RFC3339),
		"ended_at":         endedAt.Format(time.RFC3339),
	}
	if err := writer.Write(metadata); err != nil {
		return fmt.Errorf("write metadata: %w", err)
	}

	// Write traces
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

	fmt.Fprintf(os.Stderr, "Generated %d traces from session %s\n", len(traces), sessionID)

	return nil
}
