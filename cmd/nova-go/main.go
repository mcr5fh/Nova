package main

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

func init() {
	// Load .env file if it exists (silently ignore if not found)
	_ = godotenv.Load()
}

func main() {
	if err := newRootCommand().Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func newRootCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "nova-go",
		Short: "Nova trace hook handler for Claude Code",
		Long: `nova-go is a session-based trace collection tool for Claude Code that
captures session lifecycle events and parses transcripts for structured analysis.`,
	}

	cmd.AddCommand(newProcessTranscriptCommand()) // SessionEnd hook
	cmd.AddCommand(newOrchestrateCommand())       // Task orchestrator
	return cmd
}
