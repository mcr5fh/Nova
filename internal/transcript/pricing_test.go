package transcript

import (
	"math"
	"testing"
)

func TestPricingCalculator(t *testing.T) {
	calc := NewPricingCalculator()

	tests := []struct {
		name     string
		model    string
		usage    *Usage
		wantCost float64 // approximate
	}{
		{
			name:  "sonnet 4.5 basic",
			model: "claude-sonnet-4-5-20250929",
			usage: &Usage{
				InputTokens:  1000,
				OutputTokens: 500,
			},
			wantCost: 0.0105, // (1000/1M * $3) + (500/1M * $15) = $0.003 + $0.0075
		},
		{
			name:  "sonnet 4.5 with cache",
			model: "claude-sonnet-4-5-20250929",
			usage: &Usage{
				InputTokens:              1000,
				CacheCreationInputTokens: 5000,
				CacheReadInputTokens:     2000,
				OutputTokens:             500,
			},
			// (1000/1M * $3) + (5000/1M * $3.75) + (2000/1M * $0.30) + (500/1M * $15)
			// = $0.003 + $0.01875 + $0.0006 + $0.0075 = $0.02985
			wantCost: 0.02985,
		},
		{
			name:  "opus 4.5 with cache",
			model: "claude-opus-4-5-20251101",
			usage: &Usage{
				InputTokens:              1000,
				CacheCreationInputTokens: 50000,
				CacheReadInputTokens:     10000,
				OutputTokens:             500,
			},
			// (1000/1M * $15) + (50000/1M * $18.75) + (10000/1M * $1.50) + (500/1M * $75)
			// = $0.015 + $0.9375 + $0.015 + $0.0375 = $1.005
			wantCost: 1.005,
		},
		{
			name:  "haiku 3.5",
			model: "claude-haiku-3-5-20241022",
			usage: &Usage{
				InputTokens:  1000,
				OutputTokens: 500,
			},
			wantCost: 0.0028, // (1000/1M * $0.8) + (500/1M * $4) = $0.0008 + $0.002
		},
		{
			name:  "unknown model returns zero",
			model: "unknown-model-xyz",
			usage: &Usage{
				InputTokens:  1000,
				OutputTokens: 500,
			},
			wantCost: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cost := calc.Calculate(tt.model, tt.usage)

			// Use approximate comparison (within 0.00001)
			diff := math.Abs(cost - tt.wantCost)
			if diff > 0.00001 {
				t.Errorf("Calculate(%s) = %f, want ~%f (diff: %f)", tt.model, cost, tt.wantCost, diff)
			}
		})
	}
}

func TestExtractModelFamily(t *testing.T) {
	tests := []struct {
		fullModel string
		want      string
	}{
		{"claude-sonnet-4-5-20250929", "claude-sonnet-4-5"},
		{"claude-opus-4-5-20251101", "claude-opus-4-5"},
		{"claude-haiku-3-5-20241022", "claude-haiku-3-5"},
		{"claude-sonnet-4-5", "claude-sonnet-4-5"}, // already short form
		{"unknown", "unknown"},                     // fallback
	}

	for _, tt := range tests {
		t.Run(tt.fullModel, func(t *testing.T) {
			got := extractModelFamily(tt.fullModel)
			if got != tt.want {
				t.Errorf("extractModelFamily(%q) = %q, want %q", tt.fullModel, got, tt.want)
			}
		})
	}
}
