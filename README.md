# Nova

Nova is a fractal task orchestrator with integrated trace collection for Claude Code interactions.

## Project Structure

```
.
├── cmd/
│   └── nova-go/          # Main CLI application entry point
├── internal/
│   ├── hook/             # Claude Code hook input parser
│   ├── trace/            # Trace record builder
│   └── storage/          # JSONL trace storage writer
└── go.mod                # Go module definition
```

## Dependencies

- **cobra** - CLI framework for building the nova-go command
- **uuid** - UUID generation for trace identifiers

## Building

```bash
go build ./cmd/nova-go
```

## Testing

```bash
go test ./...
```

## Development

- All packages follow Go best practices with corresponding test files
- Use `go vet` for static analysis
- Use `gofmt` for code formatting
