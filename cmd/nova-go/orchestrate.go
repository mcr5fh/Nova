package main

import (
	"context"
	"fmt"
	"os"

	"github.com/mattruiters/nova/internal/beads"
	"github.com/mattruiters/nova/internal/engine"
	"github.com/mattruiters/nova/internal/executor"
	"github.com/mattruiters/nova/internal/llm"
	"github.com/spf13/cobra"
)

func newOrchestrateCommand() *cobra.Command {
	var (
		specFile    string
		maxDepth    int
		maxAttempts int
		claudePath  string
	)

	cmd := &cobra.Command{
		Use:   "orchestrate",
		Short: "Run the Nova task orchestrator",
		Long:  `Orchestrate reads a specification file, recursively decomposes it into tasks, and executes them using the fractal task orchestrator pattern.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runOrchestrate(specFile, maxDepth, maxAttempts, claudePath)
		},
	}

	cmd.Flags().StringVar(&specFile, "spec", "spec.md", "Path to specification file")
	cmd.Flags().IntVar(&maxDepth, "max-depth", 5, "Maximum recursion depth")
	cmd.Flags().IntVar(&maxAttempts, "max-attempts", 3, "Maximum retry attempts per task")
	cmd.Flags().StringVar(&claudePath, "claude", "claude", "Path to Claude CLI binary")

	return cmd
}

func runOrchestrate(specFile string, maxDepth, maxAttempts int, claudePath string) error {
	ctx := context.Background()

	// Read the spec file
	specContent, err := os.ReadFile(specFile)
	if err != nil {
		return fmt.Errorf("failed to read spec file: %w", err)
	}

	// Initialize components
	beadsClient := beads.NewClient()

	// Create the orchestrator
	orch := engine.NewOrchestrator(beadsClient, engine.OrchestratorConfig{
		MaxDepth:    maxDepth,
		MaxAttempts: maxAttempts,
	})

	// Set up the LLM components
	planner := llm.NewBAMLPlanner(beadsClient)
	executor := executor.NewClaudeExecutor(beadsClient, executor.ClaudeConfig{
		CLIPath: claudePath,
	})
	validator := llm.NewBAMLValidator(beadsClient)
	escalator := llm.NewBAMLEscalator(beadsClient)

	orch.SetPlanner(planner)
	orch.SetExecutor(executor)
	orch.SetValidator(validator)
	orch.SetEscalator(escalator)

	// Create the root task from the spec
	rootTask, err := beadsClient.CreateTask(beads.CreateTaskRequest{
		Title:       "Root task from " + specFile,
		Description: string(specContent),
		Type:        beads.TaskTypeFeature,
		Priority:    2,
	})
	if err != nil {
		return fmt.Errorf("failed to create root task: %w", err)
	}

	fmt.Printf("Created root task: %s\n", rootTask.ID)
	fmt.Printf("Processing task tree...\n")

	// Process the task
	if err := orch.ProcessTask(ctx, rootTask.ID, 0); err != nil {
		return fmt.Errorf("orchestration failed: %w", err)
	}

	fmt.Printf("✓ Task completed successfully: %s\n", rootTask.ID)
	return nil
}
