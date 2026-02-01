package hook

import (
	"strings"
	"testing"
)

func TestParseInput(t *testing.T) {
	tests := map[string]struct {
		input       string
		expected    *HookInput
		expectError bool
	}{
		"valid PreToolUse": {
			input: `{"session_id":"abc123","hook_event_name":"PreToolUse","tool_name":"Read","cwd":"/tmp"}`,
			expected: &HookInput{
				SessionID:     "abc123",
				HookEventName: "PreToolUse",
				ToolName:      "Read",
				CWD:           "/tmp",
			},
		},
		"valid PostToolUse": {
			input: `{"session_id":"xyz789","hook_event_name":"PostToolUse","tool_name":"Bash","cwd":"/home/user"}`,
			expected: &HookInput{
				SessionID:     "xyz789",
				HookEventName: "PostToolUse",
				ToolName:      "Bash",
				CWD:           "/home/user",
			},
		},
		"valid UserPromptSubmit": {
			input: `{"session_id":"test456","hook_event_name":"UserPromptSubmit","prompt":"hello world","cwd":"/workspace"}`,
			expected: &HookInput{
				SessionID:     "test456",
				HookEventName: "UserPromptSubmit",
				Prompt:        "hello world",
				CWD:           "/workspace",
			},
		},
		"missing session_id": {
			input:       `{"hook_event_name":"PreToolUse"}`,
			expectError: true,
		},
		"missing hook_event_name": {
			input:       `{"session_id":"test123"}`,
			expectError: true,
		},
		"invalid JSON": {
			input:       `{invalid json}`,
			expectError: true,
		},
		"empty input": {
			input:       ``,
			expectError: true,
		},
		"with tool_input": {
			input: `{"session_id":"test","hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":"/tmp/test.txt"},"cwd":"/"}`,
			expected: &HookInput{
				SessionID:     "test",
				HookEventName: "PreToolUse",
				ToolName:      "Read",
				ToolInput: map[string]interface{}{
					"file_path": "/tmp/test.txt",
				},
				CWD: "/",
			},
		},
		"with tool_output": {
			input: `{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Bash","tool_output":{"exit_code":0,"stdout":"success"},"cwd":"/"}`,
			expected: &HookInput{
				SessionID:     "test",
				HookEventName: "PostToolUse",
				ToolName:      "Bash",
				ToolOutput: map[string]interface{}{
					"exit_code": float64(0), // JSON numbers decode to float64
					"stdout":    "success",
				},
				CWD: "/",
			},
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			result, err := ParseInput(strings.NewReader(tt.input))

			if tt.expectError {
				if err == nil {
					t.Fatal("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.SessionID != tt.expected.SessionID {
				t.Errorf("SessionID: got %q, want %q", result.SessionID, tt.expected.SessionID)
			}

			if result.HookEventName != tt.expected.HookEventName {
				t.Errorf("HookEventName: got %q, want %q", result.HookEventName, tt.expected.HookEventName)
			}

			if result.ToolName != tt.expected.ToolName {
				t.Errorf("ToolName: got %q, want %q", result.ToolName, tt.expected.ToolName)
			}

			if result.Prompt != tt.expected.Prompt {
				t.Errorf("Prompt: got %q, want %q", result.Prompt, tt.expected.Prompt)
			}

			if result.CWD != tt.expected.CWD {
				t.Errorf("CWD: got %q, want %q", result.CWD, tt.expected.CWD)
			}

			// For complex fields, we just check they're not nil if expected
			if tt.expected.ToolInput != nil && result.ToolInput == nil {
				t.Error("expected ToolInput to be non-nil")
			}

			if tt.expected.ToolOutput != nil && result.ToolOutput == nil {
				t.Error("expected ToolOutput to be non-nil")
			}
		})
	}
}
