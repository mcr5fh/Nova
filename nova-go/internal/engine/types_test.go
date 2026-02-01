package engine

import (
	"testing"
)

// Test WorkerResult creation
func TestWorkerResultCreation(t *testing.T) {
	result := WorkerResult{
		TaskID:      "task-1",
		Success:     true,
		OutputFiles: []string{"file1.go", "file2.go"},
		Summary:     "Task completed successfully",
		Confidence:  0.9,
	}

	if result.TaskID != "task-1" {
		t.Errorf("Expected TaskID to be 'task-1', got '%s'", result.TaskID)
	}
	if !result.Success {
		t.Error("Expected Success to be true")
	}
	if result.Confidence != 0.9 {
		t.Errorf("Expected Confidence to be 0.9, got %f", result.Confidence)
	}
}

// Test ValidationResult
func TestValidationResult(t *testing.T) {
	result := ValidationResult{
		TaskID:  "task-1",
		Passed:  true,
		Message: "All tests passed",
	}

	if result.TaskID != "task-1" {
		t.Errorf("Expected TaskID to be 'task-1', got '%s'", result.TaskID)
	}
	if !result.Passed {
		t.Error("Expected Passed to be true")
	}
}

// Test EscalationDecision
func TestEscalationDecision(t *testing.T) {
	decision := EscalationDecision{
		TaskID:      "task-1",
		Action:      EscalationActionFix,
		Reason:      "Missing context",
		FixerPrompt: "Add error handling for edge cases",
	}

	if decision.TaskID != "task-1" {
		t.Errorf("Expected TaskID to be 'task-1', got '%s'", decision.TaskID)
	}
	if decision.Action != EscalationActionFix {
		t.Errorf("Expected Action to be EscalationActionFix, got '%s'", decision.Action)
	}
}

// Test EscalationAction values
func TestEscalationActionValues(t *testing.T) {
	validActions := []EscalationAction{
		EscalationActionFix,
		EscalationActionHuman,
		EscalationActionSkip,
	}

	for _, action := range validActions {
		if action == "" {
			t.Error("EscalationAction should not be empty")
		}
	}
}

// Test Telemetry data
func TestTelemetryData(t *testing.T) {
	telemetry := TelemetryData{
		TaskID:     "task-1",
		AttemptNum: 1,
		Model:      "gpt-4o-mini",
		TokensUsed: 1500,
		DurationMs: 2500,
		CostUSD:    0.015,
	}

	if telemetry.TaskID != "task-1" {
		t.Errorf("Expected TaskID to be 'task-1', got '%s'", telemetry.TaskID)
	}
	if telemetry.AttemptNum != 1 {
		t.Errorf("Expected AttemptNum to be 1, got %d", telemetry.AttemptNum)
	}
	if telemetry.Model != "gpt-4o-mini" {
		t.Errorf("Expected Model to be 'gpt-4o-mini', got '%s'", telemetry.Model)
	}
}

// Test WorkerConfig
func TestWorkerConfig(t *testing.T) {
	config := WorkerConfig{
		Model:       "gpt-4o-mini",
		MaxAttempts: 3,
		Temperature: 0.3,
		MaxTokens:   2048,
	}

	if config.Model != "gpt-4o-mini" {
		t.Errorf("Expected Model to be 'gpt-4o-mini', got '%s'", config.Model)
	}
	if config.MaxAttempts != 3 {
		t.Errorf("Expected MaxAttempts to be 3, got %d", config.MaxAttempts)
	}
}
