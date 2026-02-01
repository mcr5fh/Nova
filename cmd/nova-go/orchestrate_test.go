package main

import (
	"testing"
)

// Test creating the orchestrate command
func TestNewOrchestrateCommand(t *testing.T) {
	cmd := newOrchestrateCommand()

	if cmd == nil {
		t.Fatal("Expected command to be created")
	}

	if cmd.Use != "orchestrate" {
		t.Errorf("Expected Use to be 'orchestrate', got '%s'", cmd.Use)
	}

	// Check that spec flag exists
	specFlag := cmd.Flags().Lookup("spec")
	if specFlag == nil {
		t.Error("Expected --spec flag to exist")
	}
}
