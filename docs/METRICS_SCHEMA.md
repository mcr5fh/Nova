# Metrics JSON Schema

When a worker completes a task, the bead orchestrator automatically adds a structured JSON comment with execution metrics.

## Schema Definition

```json
{
  "type": "metrics",
  "token_usage": {
    "input_tokens": int,
    "output_tokens": int,
    "cache_read_tokens": int,
    "cache_creation_tokens": int
  },
  "cost_usd": float,
  "duration_seconds": int
}
```

## Field Descriptions

- **type**: Always `"metrics"` for metrics comments. This field enables future extensibility for other comment types.
- **token_usage**: Token consumption breakdown for the task execution
  - **input_tokens**: Number of input tokens processed
  - **output_tokens**: Number of output tokens generated
  - **cache_read_tokens**: Number of tokens read from cache
  - **cache_creation_tokens**: Number of tokens written to cache
- **cost_usd**: Total cost in USD for the task execution (calculated using Sonnet 4.5 pricing)
- **duration_seconds**: Task execution duration in seconds (integer)

## Example

```json
{
  "type": "metrics",
  "token_usage": {
    "input_tokens": 1500,
    "output_tokens": 750,
    "cache_read_tokens": 3000,
    "cache_creation_tokens": 500
  },
  "cost_usd": 0.0234,
  "duration_seconds": 120
}
```

## Retrieving Metrics

To view metrics for a completed bead:

```bash
bd comments <bead-id>
```

To get metrics in JSON format:

```bash
bd comments <bead-id> --json
```

## Implementation

Metrics are added as comments (not notes) to enable:
- Multiple metrics entries if a task is retried
- Separation from human-written notes
- Structured querying and aggregation
- Historical tracking without overwriting previous data
