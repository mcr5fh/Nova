package hook

// HookInput represents the JSON structure received from Claude Code hooks via stdin.
// This structure aligns with the Claude Code hook specification.
type HookInput struct {
	// Core identifiers
	SessionID      string `json:"session_id"`
	TranscriptPath string `json:"transcript_path,omitempty"`
	CWD            string `json:"cwd,omitempty"`
	PermissionMode string `json:"permission_mode,omitempty"`

	// Hook event details
	HookEventName string `json:"hook_event_name"`

	// Tool details (for PreToolUse and PostToolUse hooks)
	ToolName   string                 `json:"tool_name,omitempty"`
	ToolInput  map[string]interface{} `json:"tool_input,omitempty"`
	ToolOutput map[string]interface{} `json:"tool_output,omitempty"`
	ToolUseID  string                 `json:"tool_use_id,omitempty"`

	// User prompt (for UserPromptSubmit hook)
	Prompt string `json:"prompt,omitempty"`
}
