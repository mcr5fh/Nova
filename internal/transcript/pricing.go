package transcript

import (
	"strings"
)

type PricingCalculator struct {
	// Prices per million tokens (as of 2026-01-31)
	prices map[string]ModelPricing
}

type ModelPricing struct {
	InputPerMillion      float64
	OutputPerMillion     float64
	CacheWritePerMillion float64
	CacheReadPerMillion  float64
}

func NewPricingCalculator() *PricingCalculator {
	return &PricingCalculator{
		prices: map[string]ModelPricing{
			"claude-sonnet-4-5": {
				InputPerMillion:      3.00,
				OutputPerMillion:     15.00,
				CacheWritePerMillion: 3.75,
				CacheReadPerMillion:  0.30,
			},
			"claude-opus-4-5": {
				InputPerMillion:      15.00,
				OutputPerMillion:     75.00,
				CacheWritePerMillion: 18.75,
				CacheReadPerMillion:  1.50,
			},
			"claude-haiku-3-5": {
				InputPerMillion:      0.80,
				OutputPerMillion:     4.00,
				CacheWritePerMillion: 1.00,
				CacheReadPerMillion:  0.08,
			},
		},
	}
}

func (pc *PricingCalculator) Calculate(model string, usage *Usage) float64 {
	// Extract model family from full model string
	// e.g. "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
	modelFamily := extractModelFamily(model)

	pricing, ok := pc.prices[modelFamily]
	if !ok {
		// Unknown model, return 0
		return 0
	}

	cost := 0.0

	// Regular input tokens
	cost += float64(usage.InputTokens) / 1_000_000 * pricing.InputPerMillion

	// Cache creation (write) tokens
	cost += float64(usage.CacheCreationInputTokens) / 1_000_000 * pricing.CacheWritePerMillion

	// Cache read tokens
	cost += float64(usage.CacheReadInputTokens) / 1_000_000 * pricing.CacheReadPerMillion

	// Output tokens
	cost += float64(usage.OutputTokens) / 1_000_000 * pricing.OutputPerMillion

	return cost
}

func extractModelFamily(fullModel string) string {
	// "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
	// "claude-opus-4-5-20251101" -> "claude-opus-4-5"

	parts := strings.Split(fullModel, "-")
	if len(parts) >= 4 {
		// Take first 4 parts: claude-sonnet-4-5
		return strings.Join(parts[:4], "-")
	}
	return fullModel
}
