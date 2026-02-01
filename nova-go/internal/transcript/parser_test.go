package transcript

import (
	"testing"
)

func TestParseRealTranscript(t *testing.T) {
	parser := NewParser()

	// Use real transcript sample
	traces, err := parser.Parse("testdata/sample_transcript.jsonl", "test-session")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	if len(traces) == 0 {
		t.Fatal("no traces extracted")
	}

	// Verify first trace has expected fields
	first := traces[0]
	if first.SessionID != "test-session" {
		t.Errorf("session_id = %q, want %q", first.SessionID, "test-session")
	}
	if first.ToolName == "" {
		t.Error("tool_name is empty")
	}
	if first.EventType != "tool_use" {
		t.Errorf("event_type = %q, want %q", first.EventType, "tool_use")
	}
	if first.SpanID == "" {
		t.Error("span_id is empty")
	}
	if first.TraceID != "test-session" {
		t.Errorf("trace_id = %q, want %q", first.TraceID, "test-session")
	}
}

func TestExtractToolUses(t *testing.T) {
	tests := []struct {
		name           string
		transcriptFile string
		wantToolCount  int
		wantTools      []string // tool names we expect
	}{
		{
			name:           "sample with read, bash, and write",
			transcriptFile: "testdata/sample_transcript.jsonl",
			wantToolCount:  3,
			wantTools:      []string{"Read", "Bash", "Write"},
		},
	}

	parser := NewParser()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			traces, err := parser.Parse(tt.transcriptFile, "test")
			if err != nil {
				t.Fatalf("parse failed: %v", err)
			}

			if len(traces) != tt.wantToolCount {
				t.Errorf("got %d traces, want %d", len(traces), tt.wantToolCount)
			}

			// Check we found expected tools
			foundTools := make(map[string]bool)
			for _, trace := range traces {
				foundTools[trace.ToolName] = true
			}

			for _, tool := range tt.wantTools {
				if !foundTools[tool] {
					t.Errorf("did not find expected tool: %s", tool)
				}
			}
		})
	}
}

func TestTokenMetricsExtraction(t *testing.T) {
	parser := NewParser()
	traces, err := parser.Parse("testdata/sample_transcript.jsonl", "test")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// All traces in sample should have metrics
	if len(traces) == 0 {
		t.Fatal("no traces extracted")
	}

	for _, trace := range traces {
		if trace.Metrics.InputTokens == 0 && trace.Metrics.OutputTokens == 0 {
			t.Errorf("trace %s has no token metrics", trace.SpanID)
		}

		// Verify cost calculated
		if trace.Metrics.CostUSD == 0 {
			t.Error("cost not calculated despite having token counts")
		}

		t.Logf("Trace %s: tool=%s input=%d output=%d cache_read=%d cache_write=%d cost=$%.6f",
			trace.SpanID[:8], trace.ToolName,
			trace.Metrics.InputTokens, trace.Metrics.OutputTokens,
			trace.Metrics.CacheReadInputTokens, trace.Metrics.CacheCreationInputTokens,
			trace.Metrics.CostUSD)
	}
}

func TestParseEmptyTranscript(t *testing.T) {
	// Test with empty file
	parser := NewParser()
	traces, err := parser.Parse("testdata/empty_transcript.jsonl", "test")
	if err != nil {
		t.Fatalf("parse empty transcript failed: %v", err)
	}
	if len(traces) != 0 {
		t.Errorf("got %d traces from empty file, want 0", len(traces))
	}
}

func TestParseMalformedLines(t *testing.T) {
	// Test with some malformed JSON lines mixed in
	parser := NewParser()
	traces, err := parser.Parse("testdata/malformed_transcript.jsonl", "test")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	// Should skip malformed lines and continue
	if len(traces) != 2 {
		t.Errorf("got %d traces, want 2 (should skip malformed line)", len(traces))
	}
}

func TestParseNonExistentFile(t *testing.T) {
	parser := NewParser()
	_, err := parser.Parse("testdata/nonexistent.jsonl", "test")
	if err == nil {
		t.Error("expected error for nonexistent file, got nil")
	}
}

func TestRealisticSessionTranscript(t *testing.T) {
	// Test with realistic transcript data simulating an actual coding session
	parser := NewParser()
	traces, err := parser.Parse("testdata/realistic_session.jsonl", "realistic-session-001")
	if err != nil {
		t.Fatalf("parse realistic session failed: %v", err)
	}

	// Should extract 9 tool uses (user messages and text-only responses are skipped)
	expectedTools := 9
	if len(traces) != expectedTools {
		t.Errorf("got %d traces, want %d", len(traces), expectedTools)
	}

	// Verify we have a mix of different tools
	toolCounts := make(map[string]int)
	for _, trace := range traces {
		toolCounts[trace.ToolName]++
	}

	expectedToolTypes := []string{"Bash", "Read", "Write", "Edit", "Task", "Grep"}
	for _, tool := range expectedToolTypes {
		if toolCounts[tool] == 0 {
			t.Errorf("expected to find tool %s but got 0 occurrences", tool)
		}
	}

	// Verify cache hits are properly tracked
	var foundCacheHits bool
	for _, trace := range traces {
		if trace.Metrics.CacheReadInputTokens > 0 {
			foundCacheHits = true
			break
		}
	}
	if !foundCacheHits {
		t.Error("expected to find cache hits in realistic session data")
	}

	// Verify different model types are handled
	modelTypes := make(map[string]bool)
	for _, trace := range traces {
		// Track model via cost patterns
		if trace.Metrics.CostUSD > 0 {
			modelTypes["has_cost"] = true
		}
	}
	if !modelTypes["has_cost"] {
		t.Error("expected cost calculations for realistic data")
	}
}

func TestEdgeCases(t *testing.T) {
	parser := NewParser()
	traces, err := parser.Parse("testdata/edge_cases.jsonl", "edge-case-session")
	if err != nil {
		t.Fatalf("parse edge cases failed: %v", err)
	}

	// Should extract 4 valid tool uses:
	// 1. Tool with zero tokens (valid but unusual)
	// 2. Tool with nil usage (valid - parser doesn't require usage)
	// 3. Tool with very long name and large token counts
	// 4. Tool with unknown model (should still parse, but cost=0)
	// Skips: empty tool name, nil message, user messages, text-only, empty content
	expectedTraces := 4
	if len(traces) != expectedTraces {
		t.Errorf("got %d traces, want %d", len(traces), expectedTraces)
		for i, trace := range traces {
			t.Logf("  %d: tool=%s tokens=%d/%d", i+1, trace.ToolName,
				trace.Metrics.InputTokens, trace.Metrics.OutputTokens)
		}
	}

	// Verify zero-token trace is included
	var foundZeroTokens bool
	for _, trace := range traces {
		if trace.Metrics.InputTokens == 0 && trace.Metrics.OutputTokens == 0 {
			foundZeroTokens = true
			if trace.Metrics.CostUSD != 0 {
				t.Error("zero-token trace should have zero cost")
			}
		}
	}
	if !foundZeroTokens {
		t.Error("expected to find zero-token trace in edge cases")
	}

	// Verify very large token counts are handled
	var foundLargeTokens bool
	for _, trace := range traces {
		if trace.Metrics.InputTokens > 100000 {
			foundLargeTokens = true
			// Should have non-zero cost despite unknown model handling
			if trace.Metrics.CostUSD <= 0 {
				t.Error("large token count should result in non-zero cost")
			}
		}
	}
	if !foundLargeTokens {
		t.Error("expected to find large token counts in edge cases")
	}

	// Verify unknown model returns zero cost
	var foundUnknownModel bool
	for _, trace := range traces {
		// The unknown model has 1000 input + 500 output tokens
		if trace.Metrics.InputTokens == 1000 && trace.Metrics.OutputTokens == 500 {
			// This is the unknown model case - should have zero cost
			if trace.Metrics.CostUSD != 0 {
				t.Error("unknown model should have zero cost")
			}
			foundUnknownModel = true
		}
	}
	if !foundUnknownModel {
		t.Error("expected to find unknown model case")
	}
}

func TestMultipleToolsInSingleMessage(t *testing.T) {
	// Test transcript with multiple tool uses in a single assistant message
	parser := NewParser()
	traces, err := parser.Parse("testdata/realistic_session.jsonl", "test")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// Find the message with multiple tools (Write + Bash in same message)
	// This simulates Claude calling multiple tools in parallel
	var foundMultiToolMessage bool
	sessionToolCounts := make(map[string]int)

	for _, trace := range traces {
		sessionToolCounts[trace.Timestamp]++
	}

	for _, count := range sessionToolCounts {
		if count >= 2 {
			foundMultiToolMessage = true
			break
		}
	}

	if !foundMultiToolMessage {
		t.Error("expected to find message with multiple tool uses")
	}
}

func TestModelFamilyDetection(t *testing.T) {
	// Verify different Claude models are properly handled
	parser := NewParser()
	traces, err := parser.Parse("testdata/realistic_session.jsonl", "test")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	// Should have traces with different cost patterns indicating different models
	// Sonnet, Opus, and Haiku have very different pricing
	costVariances := make(map[int]bool)
	for _, trace := range traces {
		if trace.Metrics.InputTokens > 0 && trace.Metrics.CostUSD > 0 {
			// Calculate cost per 1k input tokens
			costPer1k := (trace.Metrics.CostUSD / float64(trace.Metrics.InputTokens)) * 1000
			costVariances[int(costPer1k*1000000)] = true
		}
	}

	// Should have at least 2 different cost patterns (different models)
	if len(costVariances) < 2 {
		t.Logf("Found %d different cost patterns, expected at least 2", len(costVariances))
		t.Error("expected multiple model types in realistic session")
	}
}

func TestCacheMetricsAccuracy(t *testing.T) {
	// Verify cache metrics are accurately extracted and costed
	parser := NewParser()
	traces, err := parser.Parse("testdata/realistic_session.jsonl", "test")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	var totalCacheReads int
	var totalCacheWrites int

	for _, trace := range traces {
		totalCacheReads += trace.Metrics.CacheReadInputTokens
		totalCacheWrites += trace.Metrics.CacheCreationInputTokens

		// If cache tokens exist, cost should be non-zero
		if trace.Metrics.CacheReadInputTokens > 0 || trace.Metrics.CacheCreationInputTokens > 0 {
			if trace.Metrics.CostUSD == 0 {
				t.Errorf("trace %s has cache tokens but zero cost", trace.SpanID[:8])
			}
		}
	}

	// Realistic session should have cache activity
	if totalCacheReads == 0 {
		t.Error("expected cache read activity in realistic session")
	}
	if totalCacheWrites == 0 {
		t.Error("expected cache write activity in realistic session")
	}

	t.Logf("Total cache reads: %d tokens", totalCacheReads)
	t.Logf("Total cache writes: %d tokens", totalCacheWrites)
}

func TestSpanIDUniqueness(t *testing.T) {
	// Verify all generated span IDs are unique
	parser := NewParser()
	traces, err := parser.Parse("testdata/realistic_session.jsonl", "test")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	spanIDs := make(map[string]bool)
	for _, trace := range traces {
		if spanIDs[trace.SpanID] {
			t.Errorf("duplicate span ID found: %s", trace.SpanID)
		}
		spanIDs[trace.SpanID] = true

		// Verify span ID is valid UUID format
		if len(trace.SpanID) != 36 {
			t.Errorf("span ID %s is not valid UUID format (expected 36 chars, got %d)",
				trace.SpanID, len(trace.SpanID))
		}
	}
}

func TestSessionIDPropagation(t *testing.T) {
	// Verify session ID is properly propagated to all traces
	parser := NewParser()
	testSessionID := "test-session-propagation-123"
	traces, err := parser.Parse("testdata/realistic_session.jsonl", testSessionID)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	for _, trace := range traces {
		if trace.SessionID != testSessionID {
			t.Errorf("trace %s has session_id=%s, want %s",
				trace.SpanID[:8], trace.SessionID, testSessionID)
		}
		if trace.TraceID != testSessionID {
			t.Errorf("trace %s has trace_id=%s, want %s (should match session_id)",
				trace.SpanID[:8], trace.TraceID, testSessionID)
		}
	}
}
