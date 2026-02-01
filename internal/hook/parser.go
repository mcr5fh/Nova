package hook

import (
	"encoding/json"
	"fmt"
	"io"
)

// ParseInput reads and parses hook input JSON from stdin
func ParseInput(r io.Reader) (*HookInput, error) {
	var input HookInput
	if err := json.NewDecoder(r).Decode(&input); err != nil {
		return nil, fmt.Errorf("decode JSON: %w", err)
	}

	// Validate required fields
	if input.SessionID == "" {
		return nil, fmt.Errorf("missing session_id")
	}
	if input.HookEventName == "" {
		return nil, fmt.Errorf("missing hook_event_name")
	}

	return &input, nil
}
