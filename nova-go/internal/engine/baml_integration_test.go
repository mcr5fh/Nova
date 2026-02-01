package engine

import (
	"testing"

	"github.com/mattruiters/nova/baml_client"
	"github.com/mattruiters/nova/baml_client/types"
)

// Test that all required BAML function signatures exist
func TestBAMLFunctionSignatures(t *testing.T) {
	// These checks ensure the BAML functions are properly generated
	// We're just checking they exist, not calling them (which would require API keys)

	// PlanTask function should exist
	t.Run("PlanTask exists", func(t *testing.T) {
		// The function exists if we can reference it
		_ = baml_client.PlanTask
	})

	// ExecuteTask function should exist
	t.Run("ExecuteTask exists", func(t *testing.T) {
		_ = baml_client.ExecuteTask
	})

	// ValidateTask function should exist
	t.Run("ValidateTask exists", func(t *testing.T) {
		_ = baml_client.ValidateTask
	})

	// RouteEscalation function should exist
	t.Run("RouteEscalation exists", func(t *testing.T) {
		_ = baml_client.RouteEscalation
	})

	// FixTask function should exist
	t.Run("FixTask exists", func(t *testing.T) {
		_ = baml_client.FixTask
	})
}

// Test that BAML types are properly generated
func TestBAMLTypes(t *testing.T) {
	// Test TaskSize enum
	t.Run("TaskSize enum", func(t *testing.T) {
		size := types.TaskSizeXS
		if size != "XS" {
			t.Errorf("Expected TaskSizeXS to be 'XS', got '%s'", size)
		}
	})

	// Test EscalationAction enum
	t.Run("EscalationAction enum", func(t *testing.T) {
		action := types.EscalationActionFIX
		if action != "FIX" {
			t.Errorf("Expected EscalationActionFIX to be 'FIX', got '%s'", action)
		}
	})

	// Test PlannerDecision struct
	t.Run("PlannerDecision struct", func(t *testing.T) {
		decision := types.PlannerDecision{
			Size:         types.TaskSizeS,
			Should_split: false,
			Subtasks:     []types.SubtaskDefinition{},
			Reasoning:    "Simple task",
		}
		if decision.Size != types.TaskSizeS {
			t.Errorf("Expected Size to be TaskSizeS")
		}
		if decision.Should_split {
			t.Error("Expected Should_split to be false")
		}
	})

	// Test WorkerResult struct
	t.Run("WorkerResult struct", func(t *testing.T) {
		result := types.WorkerResult{
			Success:      true,
			Summary:      "Task completed",
			Output_files: []string{"file.go"},
			Confidence:   0.9,
			Questions:    []string{},
		}
		if !result.Success {
			t.Error("Expected Success to be true")
		}
		if result.Confidence != 0.9 {
			t.Errorf("Expected Confidence to be 0.9, got %f", result.Confidence)
		}
	})

	// Test ValidationResult struct
	t.Run("ValidationResult struct", func(t *testing.T) {
		result := types.ValidationResult{
			Passed:   true,
			Message:  "All tests passed",
			Failures: []string{},
		}
		if !result.Passed {
			t.Error("Expected Passed to be true")
		}
	})

	// Test EscalationDecision struct
	t.Run("EscalationDecision struct", func(t *testing.T) {
		decision := types.EscalationDecision{
			Action: types.EscalationActionHUMAN,
			Reason: "Needs clarification",
		}
		if decision.Action != types.EscalationActionHUMAN {
			t.Errorf("Expected Action to be EscalationActionHUMAN")
		}
	})
}
