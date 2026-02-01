package hook

// HookInput represents the JSON input received from Claude Code hooks via stdin
type HookInput struct {
	// Always present
	SessionID      string `json:"session_id"`
	TranscriptPath string `json:"transcript_path"`
	CWD            string `json:"cwd"`
	PermissionMode string `json:"permission_mode"`
	HookEventName  string `json:"hook_event_name"`

	// Event-specific (PreToolUse/PostToolUse)
	ToolName   string                 `json:"tool_name,omitempty"`
	ToolInput  map[string]interface{} `json:"tool_input,omitempty"`
	ToolOutput map[string]interface{} `json:"tool_output,omitempty"`
	ToolUseID  string                 `json:"tool_use_id,omitempty"`

	// UserPromptSubmit specific
	Prompt string `json:"prompt,omitempty"`
}
