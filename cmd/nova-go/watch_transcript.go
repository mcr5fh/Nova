package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/mattruiters/nova/internal/transcript"
	"github.com/spf13/cobra"
)

func newWatchTranscriptCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "watch-transcript <session-id> <transcript-path>",
		Short: "Watch transcript file and update live token stats",
		Args:  cobra.ExactArgs(2),
		RunE:  runWatchTranscript,
	}
}

type LiveStats struct {
	SessionID        string  `json:"session_id"`
	InputTokens      int     `json:"input_tokens"`
	OutputTokens     int     `json:"output_tokens"`
	CacheReadTokens  int     `json:"cache_read_tokens"`
	CacheWriteTokens int     `json:"cache_write_tokens"`
	CostUSD          float64 `json:"cost_usd"`
	MessageCount     int     `json:"message_count"`
	LastUpdated      string  `json:"last_updated"`
}

func runWatchTranscript(cmd *cobra.Command, args []string) error {
	sessionID := args[0]
	transcriptPath := args[1]

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home dir: %w", err)
	}
	liveStatsPath := filepath.Join(homeDir, ".claude", "traces",
		fmt.Sprintf("session-%s-live.json", sessionID))

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(liveStatsPath), 0755); err != nil {
		return fmt.Errorf("create traces directory: %w", err)
	}

	// Initialize live stats
	stats := &LiveStats{
		SessionID:   sessionID,
		LastUpdated: time.Now().Format(time.RFC3339),
	}

	// Create pricing calculator for cost calculation
	pricing := transcript.NewPricingCalculator()

	// Use tail -f to watch for new lines
	tailCmd := exec.Command("tail", "-f", "-n", "+1", transcriptPath)
	stdout, err := tailCmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("create pipe: %w", err)
	}

	if err := tailCmd.Start(); err != nil {
		return fmt.Errorf("start tail: %w", err)
	}
	defer tailCmd.Process.Kill()

	// Read and process lines as they arrive
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		var entry transcript.TranscriptEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			// Skip malformed lines
			continue
		}

		// Only process assistant messages with usage data
		if entry.Type == "assistant" && entry.Message != nil && entry.Message.Usage != nil {
			usage := entry.Message.Usage

			// Update running totals
			stats.InputTokens += usage.InputTokens
			stats.OutputTokens += usage.OutputTokens
			stats.CacheReadTokens += usage.CacheReadInputTokens
			stats.CacheWriteTokens += usage.CacheCreationInputTokens
			stats.MessageCount++

			// Calculate incremental cost
			costDelta := pricing.Calculate(entry.Message.Model, usage)
			stats.CostUSD += costDelta
			stats.LastUpdated = time.Now().Format(time.RFC3339)

			// Write updated stats
			if err := writeLiveStats(liveStatsPath, stats); err != nil {
				fmt.Fprintf(os.Stderr, "write live stats error: %v\n", err)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan transcript: %w", err)
	}

	return tailCmd.Wait()
}

func writeLiveStats(path string, stats *LiveStats) error {
	data, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal stats: %w", err)
	}

	// Write atomically using temp file + rename
	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}

	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("rename file: %w", err)
	}

	return nil
}
