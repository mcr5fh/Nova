package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/mattruiters/nova/internal/storage"
	"github.com/spf13/cobra"
)

func main() {
	if err := newRootCommand().Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func newRootCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "nova-go",
		Short: "Nova trace hook handler for Claude Code",
		Long: `nova-go is a trace collection tool for Claude Code that captures
hook events and stores them as structured traces for analysis.`,
	}

	cmd.AddCommand(newTraceCommand())
	return cmd
}

func newTraceCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "trace",
		Short: "Process hook input and write trace",
		Long: `Read hook event from stdin, process it into a trace record,
and write it to the traces directory.`,
		RunE: runTrace,
	}

	return cmd
}

func runTrace(cmd *cobra.Command, args []string) error {
	// Get project directory from environment or current directory
	projectDir := os.Getenv("CLAUDE_PROJECT_DIR")
	if projectDir == "" {
		var err error
		projectDir, err = os.Getwd()
		if err != nil {
			return fmt.Errorf("failed to get working directory: %w", err)
		}
	}

	// Read hook event from stdin
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	// Parse hook event
	var hookEvent map[string]interface{}
	if err := json.Unmarshal(input, &hookEvent); err != nil {
		return fmt.Errorf("failed to parse hook event: %w", err)
	}

	// Build trace event
	trace := buildTrace(hookEvent)

	// Write trace to storage
	tracesDir := filepath.Join(projectDir, ".claude", "traces")
	writer, err := storage.NewWriter(tracesDir)
	if err != nil {
		return fmt.Errorf("failed to create writer: %w", err)
	}
	defer writer.Close()

	if err := writer.Write(trace); err != nil {
		return fmt.Errorf("failed to write trace: %w", err)
	}

	return nil
}

func buildTrace(hookEvent map[string]interface{}) map[string]interface{} {
	// Extract session ID
	sessionID, _ := hookEvent["session_id"].(string)
	if sessionID == "" {
		sessionID = "unknown"
	}

	// Generate IDs
	traceID := sessionID // Use session ID as trace ID for now
	spanID := uuid.New().String()

	// Build trace record
	trace := map[string]interface{}{
		"trace_id":   traceID,
		"span_id":    spanID,
		"session_id": sessionID,
		"timestamp":  hookEvent["timestamp"],
		"event_type": determineEventType(),
		"hook_type":  os.Getenv("CLAUDE_HOOK_TYPE"),
	}

	// Add tool information if present
	if toolName, ok := hookEvent["tool_name"].(string); ok && toolName != "" {
		trace["tool_name"] = toolName
	}

	if toolInput, ok := hookEvent["tool_input"]; ok {
		trace["tool_input"] = toolInput
	}

	if toolOutput, ok := hookEvent["tool_output"]; ok {
		trace["tool_output"] = toolOutput
	}

	// Add metrics placeholder
	trace["metrics"] = map[string]interface{}{}

	// Add tags placeholder
	trace["tags"] = map[string]interface{}{}

	return trace
}

func determineEventType() string {
	hookType := os.Getenv("CLAUDE_HOOK_TYPE")
	switch hookType {
	case "PreToolUse":
		return "pre_tool_use"
	case "PostToolUse":
		return "post_tool_use"
	case "UserPromptSubmit":
		return "user_prompt"
	default:
		return "unknown"
	}
}
