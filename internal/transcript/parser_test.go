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
