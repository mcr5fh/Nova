package engine

import (
	"time"
)

// WorkerResult represents the output from a worker execution
type WorkerResult struct {
	TaskID      string   `json:"task_id"`
	Success     bool     `json:"success"`
	OutputFiles []string `json:"output_files,omitempty"`
	Summary     string   `json:"summary"`
	Confidence  float64  `json:"confidence"`          // 0.0 - 1.0
	Questions   []string `json:"questions,omitempty"` // Unresolved questions
	Error       string   `json:"error,omitempty"`
}

// ValidationResult represents the output from a validation check
type ValidationResult struct {
	TaskID  string   `json:"task_id"`
	Passed  bool     `json:"passed"`
	Message string   `json:"message"`
	Details []string `json:"details,omitempty"` // Specific failures or warnings
}

// EscalationAction defines what to do when a task fails
type EscalationAction string

const (
	EscalationActionFix   EscalationAction = "fix"   // Send to fixer LLM
	EscalationActionHuman EscalationAction = "human" // Request human intervention
	EscalationActionSkip  EscalationAction = "skip"  // Skip this task (mark as blocked)
)

// EscalationDecision represents the router's decision on how to handle failure
type EscalationDecision struct {
	TaskID      string           `json:"task_id"`
	Action      EscalationAction `json:"action"`
	Reason      string           `json:"reason"`
	FixerPrompt string           `json:"fixer_prompt,omitempty"` // Guidance for fixer LLM
	HumanPrompt string           `json:"human_prompt,omitempty"` // Question for human
}

// TelemetryData represents per-attempt execution metrics
type TelemetryData struct {
	TaskID       string    `json:"task_id"`
	AttemptNum   int       `json:"attempt_num"`
	Model        string    `json:"model"`
	TokensUsed   int       `json:"tokens_used"`
	DurationMs   int64     `json:"duration_ms"`
	CostUSD      float64   `json:"cost_usd"`
	Timestamp    time.Time `json:"timestamp"`
	Success      bool      `json:"success"`
	ErrorMessage string    `json:"error_message,omitempty"`
}

// WorkerConfig defines parameters for worker execution
type WorkerConfig struct {
	Model       string  `json:"model"`
	MaxAttempts int     `json:"max_attempts"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
}

// PlannerOutput represents the planner's decision for a task
type PlannerOutput struct {
	TaskID      string              `json:"task_id"`
	Size        string              `json:"size"` // XS, S, M, L, XL
	ShouldSplit bool                `json:"should_split"`
	Subtasks    []SubtaskDefinition `json:"subtasks,omitempty"`
	Reasoning   string              `json:"reasoning"`
}

// SubtaskDefinition defines a decomposed subtask
type SubtaskDefinition struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Type        string   `json:"type"`     // task, bug, feature
	Priority    int      `json:"priority"` // 0-4
	DependsOn   []string `json:"depends_on,omitempty"`
}

// HumanFeedback represents guidance from a human
type HumanFeedback struct {
	TaskID    string    `json:"task_id"`
	Feedback  string    `json:"feedback"`
	Timestamp time.Time `json:"timestamp"`
}
