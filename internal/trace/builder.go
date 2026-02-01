package trace

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/mattruiters/nova/internal/hook"
)

// Builder creates TraceEvent instances from HookInput
type Builder struct {
	spanCache map[string]string // tool_use_id -> span_id for correlating Pre/Post events
}

// NewBuilder creates a new trace builder
func NewBuilder() *Builder {
	return &Builder{
		spanCache: make(map[string]string),
	}
}

// Build creates a TraceEvent from HookInput
// MVP: No Beads integration, no metrics calculation
func (b *Builder) Build(ctx context.Context, input *hook.HookInput) (*TraceEvent, error) {
	now := time.Now()

	event := &TraceEvent{
		SessionID: input.SessionID,
		Timestamp: now.Format(time.RFC3339),
		EventType: mapEventType(input.HookEventName),
		HookType:  input.HookEventName,
		Tags:      make(map[string]string),
		Metadata:  make(map[string]interface{}),
		Metrics:   Metrics{}, // Empty metrics for MVP
	}

	// Generate or reuse span ID based on event type
	event.SpanID = b.generateSpanID(input)

	// Use session_id as trace_id for MVP (single trace per session)
	event.TraceID = input.SessionID

	// Add tool details if present
	if input.ToolName != "" {
		event.ToolName = &input.ToolName
		event.ToolInput = input.ToolInput
		event.ToolOutput = input.ToolOutput
	}

	// Add tool_use_id if present
	if input.ToolUseID != "" {
		event.ToolUseID = &input.ToolUseID
	}

	return event, nil
}

// generateSpanID creates or retrieves a span ID for the event
// PreToolUse creates a new span, PostToolUse reuses the same span
func (b *Builder) generateSpanID(input *hook.HookInput) string {
	if input.HookEventName == "PreToolUse" {
		spanID := uuid.New().String()
		if input.ToolUseID != "" {
			b.spanCache[input.ToolUseID] = spanID
		}
		return spanID
	}

	if input.HookEventName == "PostToolUse" && input.ToolUseID != "" {
		if cachedSpanID, exists := b.spanCache[input.ToolUseID]; exists {
			return cachedSpanID
		}
	}

	// Fallback: generate new UUID for user_prompt or uncached events
	return uuid.New().String()
}

// mapEventType converts hook type to event type
func mapEventType(hookType string) string {
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
