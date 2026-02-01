package trace

// TraceEvent represents a single trace event written to JSONL storage
type TraceEvent struct {
	// Core Identifiers
	TraceID   string  `json:"trace_id"`
	SpanID    string  `json:"span_id"`
	ParentID  *string `json:"parent_id"`
	SessionID string  `json:"session_id"`

	// Task Context (MVP: not populated)
	TaskID     *string `json:"task_id,omitempty"`
	TaskStatus *string `json:"task_status,omitempty"`
	TaskTitle  *string `json:"task_title,omitempty"`

	// Timing
	Timestamp  string `json:"timestamp"`
	StartTime  string `json:"start_time,omitempty"`
	EndTime    string `json:"end_time,omitempty"`
	DurationMS *int64 `json:"duration_ms,omitempty"`

	// Event Classification
	EventType string `json:"event_type"`
	HookType  string `json:"hook_type"`

	// Tool/Action Details
	ToolName   *string                `json:"tool_name,omitempty"`
	ToolInput  map[string]interface{} `json:"tool_input,omitempty"`
	ToolOutput map[string]interface{} `json:"tool_output,omitempty"`
	ToolUseID  *string                `json:"tool_use_id,omitempty"`

	// Metrics & Costs (MVP: empty struct)
	Metrics Metrics `json:"metrics"`

	// Extensibility
	Tags     map[string]string      `json:"tags"`
	Metadata map[string]interface{} `json:"metadata"`
}

// Metrics tracks resource usage for each event
type Metrics struct {
	// Token Usage (MVP: not populated)
	InputTokens      *int `json:"input_tokens,omitempty"`
	OutputTokens     *int `json:"output_tokens,omitempty"`
	CacheReadTokens  *int `json:"cache_read_tokens,omitempty"`
	CacheWriteTokens *int `json:"cache_write_tokens,omitempty"`

	// Cost Estimation (MVP: not populated)
	EstimatedCost *float64 `json:"estimated_cost,omitempty"`

	// Tool-Specific Metrics (MVP: not populated)
	ToolCount      *int `json:"tool_count,omitempty"`
	ToolErrorCount *int `json:"tool_error_count,omitempty"`

	// File Operations (MVP: not populated)
	FilesRead    *int `json:"files_read,omitempty"`
	FilesWritten *int `json:"files_written,omitempty"`
	FilesEdited  *int `json:"files_edited,omitempty"`
}
