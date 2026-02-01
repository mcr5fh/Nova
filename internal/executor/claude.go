package executor

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	"github.com/mattruiters/nova/internal/beads"
	"github.com/mattruiters/nova/internal/engine"
)

// ClaudeConfig defines configuration for Claude CLI executor
type ClaudeConfig struct {
	CLIPath string // Path to Claude CLI binary (default: "claude")
}

// ClaudeExecutor executes tasks using Claude CLI
type ClaudeExecutor struct {
	beadsClient *beads.Client
	config      ClaudeConfig
}

// NewClaudeExecutor creates a new Claude CLI executor
func NewClaudeExecutor(beadsClient *beads.Client, config ClaudeConfig) *ClaudeExecutor {
	if config.CLIPath == "" {
		config.CLIPath = "claude"
	}
	return &ClaudeExecutor{
		beadsClient: beadsClient,
		config:      config,
	}
}

// Execute implements engine.Executor
func (e *ClaudeExecutor) Execute(ctx context.Context, taskID string, attempt int) (*engine.WorkerResult, error) {
	// Get the task
	task, err := e.beadsClient.GetTask(taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// Build the prompt
	prompt := e.buildTaskPrompt(task, attempt)

	// Execute Claude CLI
	cmd := exec.CommandContext(ctx, e.config.CLIPath, "--prompt", prompt)

	// Run the command
	output, err := cmd.CombinedOutput()

	// Parse the result
	result := e.parseWorkerResult(taskID, string(output), err)

	return result, nil
}

// buildTaskPrompt constructs the prompt for Claude CLI
func (e *ClaudeExecutor) buildTaskPrompt(task *beads.Task, attempt int) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Task: %s\n\n", task.Title))
	sb.WriteString(fmt.Sprintf("**Type:** %s\n", task.Type))
	sb.WriteString(fmt.Sprintf("**Priority:** P%d\n", task.Priority))
	if task.Size != "" {
		sb.WriteString(fmt.Sprintf("**Size:** %s\n", task.Size))
	}
	sb.WriteString(fmt.Sprintf("**Attempt:** %d\n\n", attempt))

	sb.WriteString("## Description\n\n")
	sb.WriteString(task.Description)
	sb.WriteString("\n\n")

	if task.Notes != "" {
		sb.WriteString("## Additional Context\n\n")
		sb.WriteString(task.Notes)
		sb.WriteString("\n\n")
	}

	sb.WriteString("## Instructions\n\n")
	sb.WriteString("You are a focused software engineering worker executing a single, well-defined task.\n")
	sb.WriteString("Work within the scope provided and report what you accomplished.\n\n")
	sb.WriteString("Guidelines:\n")
	sb.WriteString("- Focus on the specific task at hand\n")
	sb.WriteString("- Make minimal, targeted changes\n")
	sb.WriteString("- Run tests to verify your work\n")
	sb.WriteString("- Report any blockers or ambiguities\n")
	sb.WriteString("- Be honest about your confidence level\n\n")

	sb.WriteString("When you're done, provide a brief summary including:\n")
	sb.WriteString("1. Whether you succeeded\n")
	sb.WriteString("2. What files you modified (if any)\n")
	sb.WriteString("3. A brief description of what you did\n")
	sb.WriteString("4. Your confidence level (0.0-1.0)\n")
	sb.WriteString("5. Any unresolved questions or blockers\n")

	return sb.String()
}

// parseWorkerResult parses the output from Claude CLI into a WorkerResult
func (e *ClaudeExecutor) parseWorkerResult(taskID string, output string, execError error) *engine.WorkerResult {
	result := &engine.WorkerResult{
		TaskID:      taskID,
		OutputFiles: []string{},
		Questions:   []string{},
	}

	// If there was an execution error, mark as failed
	if execError != nil {
		result.Success = false
		result.Error = execError.Error()
		result.Summary = "Task execution failed"
		result.Confidence = 0.0
		return result
	}

	// For now, do simple parsing
	// In a real implementation, we would parse structured output from Claude
	result.Summary = output
	result.Success = true
	result.Confidence = 0.8 // Default confidence

	// Try to extract information from output
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Look for file modifications
		if strings.Contains(line, "modified:") || strings.Contains(line, "created:") {
			result.OutputFiles = append(result.OutputFiles, line)
		}

		// Look for questions or blockers
		if strings.Contains(line, "question:") || strings.Contains(line, "blocker:") {
			result.Questions = append(result.Questions, line)
		}

		// Check for success indicators
		if strings.Contains(strings.ToLower(line), "failed") ||
			strings.Contains(strings.ToLower(line), "error") {
			result.Success = false
			result.Confidence = 0.3
		}
	}

	return result
}
