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
		errorMsg    string
	}{
		"valid PreToolUse with all fields": {
			input: `{
				"session_id": "abc123",
				"transcript_path": "/path/to/transcript",
				"cwd": "/home/user/project",
				"permission_mode": "auto",
				"hook_event_name": "PreToolUse",
				"tool_name": "Read",
				"tool_input": {"file_path": "test.go"},
				"tool_use_id": "tool_123"
			}`,
			expected: &HookInput{
				SessionID:      "abc123",
				TranscriptPath: "/path/to/transcript",
				CWD:            "/home/user/project",
				PermissionMode: "auto",
				HookEventName:  "PreToolUse",
				ToolName:       "Read",
				ToolInput:      map[string]interface{}{"file_path": "test.go"},
				ToolUseID:      "tool_123",
			},
		},
		"valid PostToolUse": {
			input: `{
				"session_id": "xyz789",
				"transcript_path": "/tmp/transcript",
				"cwd": "/project",
				"permission_mode": "manual",
				"hook_event_name": "PostToolUse",
				"tool_name": "Write",
				"tool_output": {"success": true}
			}`,
			expected: &HookInput{
				SessionID:      "xyz789",
				TranscriptPath: "/tmp/transcript",
				CWD:            "/project",
				PermissionMode: "manual",
				HookEventName:  "PostToolUse",
				ToolName:       "Write",
				ToolOutput:     map[string]interface{}{"success": true},
			},
		},
		"valid UserPromptSubmit": {
			input: `{
				"session_id": "prompt123",
				"transcript_path": "/tmp/t",
				"cwd": "/usr",
				"permission_mode": "auto",
				"hook_event_name": "UserPromptSubmit",
				"prompt": "Hello world"
			}`,
			expected: &HookInput{
				SessionID:      "prompt123",
				TranscriptPath: "/tmp/t",
				CWD:            "/usr",
				PermissionMode: "auto",
				HookEventName:  "UserPromptSubmit",
				Prompt:         "Hello world",
			},
		},
		"minimal valid input": {
			input: `{
				"session_id": "min123",
				"transcript_path": "",
				"cwd": "",
				"permission_mode": "",
				"hook_event_name": "PostToolUse"
			}`,
			expected: &HookInput{
				SessionID:     "min123",
				HookEventName: "PostToolUse",
			},
		},
		"missing session_id": {
			input: `{
				"transcript_path": "/tmp/t",
				"cwd": "/usr",
				"permission_mode": "auto",
				"hook_event_name": "PreToolUse"
			}`,
			expectError: true,
			errorMsg:    "missing session_id",
		},
		"missing hook_event_name": {
			input: `{
				"session_id": "test123",
				"transcript_path": "/tmp/t",
				"cwd": "/usr",
				"permission_mode": "auto"
			}`,
			expectError: true,
			errorMsg:    "missing hook_event_name",
		},
		"empty session_id": {
			input: `{
				"session_id": "",
				"hook_event_name": "PreToolUse"
			}`,
			expectError: true,
			errorMsg:    "missing session_id",
		},
		"empty hook_event_name": {
			input: `{
				"session_id": "test123",
				"hook_event_name": ""
			}`,
			expectError: true,
			errorMsg:    "missing hook_event_name",
		},
		"invalid JSON": {
			input:       `{invalid json}`,
			expectError: true,
		},
		"empty input": {
			input:       ``,
			expectError: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			reader := strings.NewReader(tt.input)
			result, err := ParseInput(reader)

			if tt.expectError {
				if err == nil {
					t.Fatal("expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result == nil {
				t.Fatal("expected result but got nil")
			}

			// Validate core fields
			if result.SessionID != tt.expected.SessionID {
				t.Errorf("SessionID: got %q, want %q", result.SessionID, tt.expected.SessionID)
			}
			if result.HookEventName != tt.expected.HookEventName {
				t.Errorf("HookEventName: got %q, want %q", result.HookEventName, tt.expected.HookEventName)
			}
			if result.TranscriptPath != tt.expected.TranscriptPath {
				t.Errorf("TranscriptPath: got %q, want %q", result.TranscriptPath, tt.expected.TranscriptPath)
			}
			if result.CWD != tt.expected.CWD {
				t.Errorf("CWD: got %q, want %q", result.CWD, tt.expected.CWD)
			}
			if result.PermissionMode != tt.expected.PermissionMode {
				t.Errorf("PermissionMode: got %q, want %q", result.PermissionMode, tt.expected.PermissionMode)
			}

			// Validate optional fields if present
			if tt.expected.ToolName != "" && result.ToolName != tt.expected.ToolName {
				t.Errorf("ToolName: got %q, want %q", result.ToolName, tt.expected.ToolName)
			}
			if tt.expected.Prompt != "" && result.Prompt != tt.expected.Prompt {
				t.Errorf("Prompt: got %q, want %q", result.Prompt, tt.expected.Prompt)
			}
		})
	}
}
