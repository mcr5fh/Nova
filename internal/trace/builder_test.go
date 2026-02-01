package trace

import (
	"context"
	"testing"

	"github.com/mattruiters/nova/internal/hook"
)

func TestBuilder_Build_PreToolUse(t *testing.T) {
	builder := NewBuilder()
	input := &hook.HookInput{
		SessionID:     "test-session-123",
		HookEventName: "PreToolUse",
		ToolName:      "Read",
		ToolUseID:     "tool-use-456",
		ToolInput: map[string]interface{}{
			"file_path": "/path/to/file.txt",
		},
	}

	event, err := builder.Build(context.Background(), input)
	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// Verify core fields
	if event.SessionID != "test-session-123" {
		t.Errorf("SessionID = %s, want test-session-123", event.SessionID)
	}
	if event.TraceID != "test-session-123" {
		t.Errorf("TraceID = %s, want test-session-123", event.TraceID)
	}
	if event.EventType != "pre_tool_use" {
		t.Errorf("EventType = %s, want pre_tool_use", event.EventType)
	}
	if event.HookType != "PreToolUse" {
		t.Errorf("HookType = %s, want PreToolUse", event.HookType)
	}
	if event.SpanID == "" {
		t.Error("SpanID should not be empty")
	}
	if event.ToolName == nil || *event.ToolName != "Read" {
		t.Error("ToolName should be Read")
	}
	if event.ToolUseID == nil || *event.ToolUseID != "tool-use-456" {
		t.Error("ToolUseID should be tool-use-456")
	}
}

func TestBuilder_Build_PostToolUse_ReusesSpanID(t *testing.T) {
	builder := NewBuilder()

	// First, create a PreToolUse event
	preInput := &hook.HookInput{
		SessionID:     "test-session-123",
		HookEventName: "PreToolUse",
		ToolName:      "Read",
		ToolUseID:     "tool-use-456",
	}
	preEvent, err := builder.Build(context.Background(), preInput)
	if err != nil {
		t.Fatalf("Build PreToolUse failed: %v", err)
	}

	// Now create a PostToolUse event with the same tool_use_id
	postInput := &hook.HookInput{
		SessionID:     "test-session-123",
		HookEventName: "PostToolUse",
		ToolName:      "Read",
		ToolUseID:     "tool-use-456",
		ToolOutput: map[string]interface{}{
			"content": "file content",
		},
	}
	postEvent, err := builder.Build(context.Background(), postInput)
	if err != nil {
		t.Fatalf("Build PostToolUse failed: %v", err)
	}

	// Verify span IDs match
	if preEvent.SpanID != postEvent.SpanID {
		t.Errorf("PreToolUse SpanID %s != PostToolUse SpanID %s (should match)", preEvent.SpanID, postEvent.SpanID)
	}
	if postEvent.EventType != "post_tool_use" {
		t.Errorf("EventType = %s, want post_tool_use", postEvent.EventType)
	}
}

func TestBuilder_Build_UserPromptSubmit(t *testing.T) {
	builder := NewBuilder()
	input := &hook.HookInput{
		SessionID:     "test-session-123",
		HookEventName: "UserPromptSubmit",
		Prompt:        "Test prompt",
	}

	event, err := builder.Build(context.Background(), input)
	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	if event.EventType != "user_prompt" {
		t.Errorf("EventType = %s, want user_prompt", event.EventType)
	}
	if event.SpanID == "" {
		t.Error("SpanID should not be empty")
	}
}

func TestMapEventType(t *testing.T) {
	tests := []struct {
		hookType string
		want     string
	}{
		{"PreToolUse", "pre_tool_use"},
		{"PostToolUse", "post_tool_use"},
		{"UserPromptSubmit", "user_prompt"},
		{"Unknown", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.hookType, func(t *testing.T) {
			got := mapEventType(tt.hookType)
			if got != tt.want {
				t.Errorf("mapEventType(%s) = %s, want %s", tt.hookType, got, tt.want)
			}
		})
	}
}
