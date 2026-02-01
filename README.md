# Nova

Nova is a fractal task orchestrator with integrated session-based trace collection for Claude Code interactions.

## Project Structure

```text
.
├── cmd/
│   └── nova-go/          # Main CLI application entry point
├── internal/
│   ├── transcript/       # Transcript parser and token tracking
│   └── storage/          # JSONL trace storage writer
└── go.mod                # Go module definition
```text

## Architecture

Nova uses a session-based architecture for trace collection:

- **SessionStart hook** - Logs session metadata and spawns background watcher
- **Background watcher** - Monitors transcript file for live token tracking
- **SessionEnd hook** - Parses full transcript and generates detailed traces

This approach provides:

- ✅ Live token tracking during sessions
- ✅ Detailed end-of-session breakdown with tool uses + token data
- ✅ Token counts (input, output, cache read, cache write)
- ✅ Cost calculation based on model pricing
- ✅ Reduced hook overhead (only at session boundaries)

## Dependencies

- **cobra** - CLI framework for building the nova-go command
- **uuid** - UUID generation for trace identifiers

## Quick Start

```bash
# Build and install
make build
make install

# Hooks are automatically configured in .claude/settings.json
# Traces are generated at session end

# View traces
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq .

# View sessions
cat ~/.claude/traces/sessions.jsonl | jq .
```text

## Building

```bash
make build
```text

## Testing

```bash
make test
```text

## Development

- All packages follow Go best practices with corresponding test files
- Use `go vet` for static analysis
- Use `gofmt` for code formatting
- Run `make lint` to check for issues
