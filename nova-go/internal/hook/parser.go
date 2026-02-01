package hook

import (
	"encoding/json"
	"fmt"
	"io"
)

// ParseInput parses hook input JSON from stdin and validates required fields.
// Returns an error if the input is invalid or missing required fields.
func ParseInput(r io.Reader) (*HookInput, error) {
	var input HookInput

	decoder := json.NewDecoder(r)
	if err := decoder.Decode(&input); err != nil {
		return nil, fmt.Errorf("decode JSON: %w", err)
	}

	// Validate required fields
	if input.SessionID == "" {
		return nil, fmt.Errorf("missing required field: session_id")
	}

	if input.HookEventName == "" {
		return nil, fmt.Errorf("missing required field: hook_event_name")
	}

	return &input, nil
}
