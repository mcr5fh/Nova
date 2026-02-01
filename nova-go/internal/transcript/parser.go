package transcript

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/google/uuid"
)

type Parser struct {
	pricing *PricingCalculator
}

func NewParser() *Parser {
	return &Parser{
		pricing: NewPricingCalculator(),
	}
}

// TranscriptEntry represents one line in the transcript JSONL
type TranscriptEntry struct {
	Type      string   `json:"type"`
	Message   *Message `json:"message,omitempty"`
	Timestamp string   `json:"timestamp"`
	SessionID string   `json:"sessionId"`
}

type Message struct {
	Model   string        `json:"model"`
	Content []ContentItem `json:"content"`
	Usage   *Usage        `json:"usage,omitempty"`
}

type ContentItem struct {
	Type  string                 `json:"type"`
	Name  string                 `json:"name,omitempty"`  // tool name
	Input map[string]interface{} `json:"input,omitempty"` // tool input
	Text  string                 `json:"text,omitempty"`  // text content
}

type Usage struct {
	InputTokens              int `json:"input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	OutputTokens             int `json:"output_tokens"`
}

// TraceEvent is what we write to traces-YYYY-MM-DD.jsonl
type TraceEvent struct {
	SessionID string                 `json:"session_id"`
	TraceID   string                 `json:"trace_id"`
	SpanID    string                 `json:"span_id"`
	Timestamp string                 `json:"timestamp"`
	EventType string                 `json:"event_type"` // "tool_use"
	ToolName  string                 `json:"tool_name"`
	ToolInput map[string]interface{} `json:"tool_input,omitempty"`
	Metrics   Metrics                `json:"metrics"`
	Tags      map[string]string      `json:"tags"`
}

type Metrics struct {
	InputTokens              int     `json:"input_tokens"`
	OutputTokens             int     `json:"output_tokens"`
	CacheCreationInputTokens int     `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int     `json:"cache_read_input_tokens"`
	CostUSD                  float64 `json:"cost_usd"`
}

// Parse reads a transcript file and generates trace events
func (p *Parser) Parse(transcriptPath string, sessionID string) ([]TraceEvent, error) {
	file, err := os.Open(transcriptPath)
	if err != nil {
		return nil, fmt.Errorf("open transcript: %w", err)
	}
	defer file.Close()

	var traces []TraceEvent
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		var entry TranscriptEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			// Skip malformed lines
			continue
		}

		// Only process assistant messages with tool uses
		if entry.Type != "assistant" || entry.Message == nil {
			continue
		}

		// Extract tool uses from content array
		for _, item := range entry.Message.Content {
			if item.Type == "tool_use" && item.Name != "" {
				trace := TraceEvent{
					SessionID: sessionID,
					TraceID:   sessionID, // Use session as trace root
					SpanID:    generateSpanID(),
					Timestamp: entry.Timestamp,
					EventType: "tool_use",
					ToolName:  item.Name,
					ToolInput: item.Input,
					Tags:      make(map[string]string),
				}

				// Add token metrics if available
				if entry.Message.Usage != nil {
					trace.Metrics = Metrics{
						InputTokens:              entry.Message.Usage.InputTokens,
						OutputTokens:             entry.Message.Usage.OutputTokens,
						CacheCreationInputTokens: entry.Message.Usage.CacheCreationInputTokens,
						CacheReadInputTokens:     entry.Message.Usage.CacheReadInputTokens,
					}

					// Calculate cost
					trace.Metrics.CostUSD = p.pricing.Calculate(
						entry.Message.Model,
						entry.Message.Usage,
					)
				}

				traces = append(traces, trace)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan transcript: %w", err)
	}

	return traces, nil
}

func generateSpanID() string {
	return uuid.New().String()
}
