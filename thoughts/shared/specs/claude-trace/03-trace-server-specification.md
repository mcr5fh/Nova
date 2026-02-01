# Claude Trace Server - Aggregator & API Specification

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-01-31

## Overview

The trace server is a Go HTTP service that:

1. Reads JSONL trace files written by the hook
2. Indexes traces in SQLite for fast queries
3. Aggregates metrics by task/session
4. Serves REST API for historical queries
5. **Streams real-time trace events via Server-Sent Events (SSE)**

---

## Architecture

```text
JSONL Files (.claude/traces/*.jsonl)
    ↓ (file watcher)
Indexer (goroutine)
    ↓ (parse & insert)
SQLite Database
    ↓ (queries)
REST API (Chi router)
    ├─ GET /api/traces (historical)
    ├─ GET /api/tasks/:id (aggregated)
    └─ GET /api/stream (SSE live feed)
        ↓
Event Broker (fan-out to clients)
    ↓
Connected Clients (EventSource)
```text

---

## Project Structure

```text
claude-trace-server/
├── cmd/
│   └── server/
│       └── main.go                 # Entry point
├── internal/
│   ├── api/
│   │   ├── server.go               # HTTP server setup
│   │   ├── routes.go               # Route definitions
│   │   ├── handlers.go             # REST handlers
│   │   └── sse.go                  # SSE streaming logic
│   ├── broker/
│   │   ├── broker.go               # Event fan-out to clients
│   │   └── types.go                # Event types
│   ├── indexer/
│   │   ├── watcher.go              # File watcher for JSONL
│   │   ├── parser.go               # Parse JSONL lines
│   │   └── inserter.go             # Insert into SQLite
│   ├── storage/
│   │   ├── db.go                   # SQLite connection
│   │   ├── queries.go              # Query builders
│   │   └── schema.go               # Schema migrations
│   └── aggregator/
│       ├── task.go                 # Aggregate by task
│       └── session.go              # Aggregate by session
├── go.mod
├── go.sum
├── Makefile
└── README.md
```text

---

## Implementation Details

### 1. Main Entry Point

**File:** `cmd/server/main.go`

```go
package main

import (
 "context"
 "fmt"
 "log/slog"
 "os"
 "os/signal"
 "syscall"
 "time"

 "github.com/yourusername/claude-trace-server/internal/api"
 "github.com/yourusername/claude-trace-server/internal/broker"
 "github.com/yourusername/claude-trace-server/internal/indexer"
 "github.com/yourusername/claude-trace-server/internal/storage"
)

func main() {
 // Setup structured logging
 logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
  Level: slog.LevelInfo,
 }))
 slog.SetDefault(logger)

 ctx, cancel := context.WithCancel(context.Background())
 defer cancel()

 // Initialize database
 db, err := storage.NewDB(ctx, "./traces.db")
 if err != nil {
  slog.Error("failed to initialize database", "error", err)
  os.Exit(1)
 }
 defer db.Close()

 // Create event broker for SSE
 eventBroker := broker.NewBroker()
 eventBroker.Start()
 defer eventBroker.Stop()

 // Start file watcher/indexer
 idx := indexer.NewIndexer(db, eventBroker)
 go idx.Watch(ctx, os.Getenv("CLAUDE_TRACE_DIR"))

 // Start HTTP server
 server := api.NewServer(db, eventBroker)
 go func() {
  addr := ":8080"
  slog.Info("starting server", "addr", addr)
  if err := server.ListenAndServe(addr); err != nil {
   slog.Error("server error", "error", err)
   cancel()
  }
 }()

 // Graceful shutdown
 sigChan := make(chan os.Signal, 1)
 signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
 <-sigChan

 slog.Info("shutting down...")
 shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
 defer shutdownCancel()

 if err := server.Shutdown(shutdownCtx); err != nil {
  slog.Error("shutdown error", "error", err)
 }
}
```text

### 2. Event Broker (SSE Core)

**File:** `internal/broker/broker.go`

The broker manages all SSE connections and broadcasts events to connected clients.

```go
package broker

import (
 "sync"

 "github.com/yourusername/claude-trace-server/internal/storage"
)

type Broker struct {
 // Map of client channels
 clients map[chan *storage.TraceEvent]ClientInfo
 mu      sync.RWMutex

 // Control channels
 register   chan chan *storage.TraceEvent
 unregister chan chan *storage.TraceEvent
 broadcast  chan *storage.TraceEvent
 done       chan struct{}
}

type ClientInfo struct {
 SessionID string // Filter by session (optional)
 TaskID    string // Filter by task (optional)
}

func NewBroker() *Broker {
 return &Broker{
  clients:    make(map[chan *storage.TraceEvent]ClientInfo),
  register:   make(chan chan *storage.TraceEvent),
  unregister: make(chan chan *storage.TraceEvent),
  broadcast:  make(chan *storage.TraceEvent, 100),
  done:       make(chan struct{}),
 }
}

func (b *Broker) Start() {
 go b.run()
}

func (b *Broker) Stop() {
 close(b.done)
}

func (b *Broker) run() {
 for {
  select {
  case client := <-b.register:
   b.mu.Lock()
   b.clients[client] = ClientInfo{}
   b.mu.Unlock()

  case client := <-b.unregister:
   b.mu.Lock()
   delete(b.clients, client)
   close(client)
   b.mu.Unlock()

  case event := <-b.broadcast:
   b.mu.RLock()
   for clientChan, info := range b.clients {
    // Apply filters if specified
    if info.SessionID != "" && event.SessionID != info.SessionID {
     continue
    }
    if info.TaskID != "" && (event.TaskID == nil || *event.TaskID != info.TaskID) {
     continue
    }

    // Non-blocking send (drop if client is slow)
    select {
    case clientChan <- event:
    default:
     // Client is too slow, skip this event
    }
   }
   b.mu.RUnlock()

  case <-b.done:
   b.mu.Lock()
   for client := range b.clients {
    close(client)
   }
   b.clients = make(map[chan *storage.TraceEvent]ClientInfo)
   b.mu.Unlock()
   return
  }
 }
}

func (b *Broker) Subscribe(sessionID, taskID string) chan *storage.TraceEvent {
 clientChan := make(chan *storage.TraceEvent, 10)
 b.mu.Lock()
 b.clients[clientChan] = ClientInfo{
  SessionID: sessionID,
  TaskID:    taskID,
 }
 b.mu.Unlock()
 return clientChan
}

func (b *Broker) Unsubscribe(clientChan chan *storage.TraceEvent) {
 b.unregister <- clientChan
}

func (b *Broker) Broadcast(event *storage.TraceEvent) {
 select {
 case b.broadcast <- event:
 default:
  // Broadcast channel full, drop event
 }
}
```text

### 3. SSE Handler

**File:** `internal/api/sse.go`

```go
package api

import (
 "encoding/json"
 "fmt"
 "net/http"
 "time"

 "log/slog"
)

// StreamTraces handles SSE connections for real-time trace streaming
func (s *Server) StreamTraces(w http.ResponseWriter, r *http.Request) {
 // 1. Set SSE headers
 w.Header().Set("Content-Type", "text/event-stream")
 w.Header().Set("Cache-Control", "no-cache")
 w.Header().Set("Connection", "keep-alive")
 w.Header().Set("Access-Control-Allow-Origin", "*") // CORS for local dev

 // 2. Get flusher for immediate writes
 flusher, ok := w.(http.Flusher)
 if !ok {
  http.Error(w, "streaming not supported", http.StatusInternalServerError)
  return
 }

 // 3. Parse optional filters
 sessionID := r.URL.Query().Get("session_id")
 taskID := r.URL.Query().Get("task_id")

 // 4. Subscribe to broker
 clientChan := s.broker.Subscribe(sessionID, taskID)
 defer s.broker.Unsubscribe(clientChan)

 slog.Info("client connected", "session_id", sessionID, "task_id", taskID)

 // 5. Create heartbeat ticker
 heartbeat := time.NewTicker(30 * time.Second)
 defer heartbeat.Stop()

 // 6. Stream events
 for {
  select {
  case event := <-clientChan:
   // Send trace event
   data, err := json.Marshal(event)
   if err != nil {
    slog.Error("failed to marshal event", "error", err)
    continue
   }

   fmt.Fprintf(w, "event: trace\n")
   fmt.Fprintf(w, "data: %s\n\n", data)
   flusher.Flush()

  case <-heartbeat.C:
   // Send heartbeat to keep connection alive
   fmt.Fprintf(w, "event: heartbeat\n")
   fmt.Fprintf(w, "data: {\"timestamp\":\"%s\"}\n\n", time.Now().Format(time.RFC3339))
   flusher.Flush()

  case <-r.Context().Done():
   // Client disconnected
   slog.Info("client disconnected", "session_id", sessionID)
   return
  }
 }
}
```text

### 4. HTTP Server with Chi

**File:** `internal/api/server.go`

```go
package api

import (
 "context"
 "net/http"
 "time"

 "github.com/go-chi/chi/v5"
 "github.com/go-chi/chi/v5/middleware"
 "github.com/go-chi/cors"

 "github.com/yourusername/claude-trace-server/internal/broker"
 "github.com/yourusername/claude-trace-server/internal/storage"
)

type Server struct {
 router *chi.Mux
 db     *storage.DB
 broker *broker.Broker
 server *http.Server
}

func NewServer(db *storage.DB, broker *broker.Broker) *Server {
 s := &Server{
  router: chi.NewRouter(),
  db:     db,
  broker: broker,
 }

 s.setupMiddleware()
 s.setupRoutes()

 return s
}

func (s *Server) setupMiddleware() {
 // Standard middleware
 s.router.Use(middleware.RequestID)
 s.router.Use(middleware.RealIP)
 s.router.Use(middleware.Logger)
 s.router.Use(middleware.Recoverer)
 s.router.Use(middleware.Timeout(60 * time.Second))

 // CORS for local development
 s.router.Use(cors.Handler(cors.Options{
  AllowedOrigins:   []string{"http://localhost:*", "http://127.0.0.1:*"},
  AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
  AllowedHeaders:   []string{"Accept", "Content-Type"},
  AllowCredentials: false,
  MaxAge:           300,
 }))
}

func (s *Server) setupRoutes() {
 // API routes
 s.router.Route("/api", func(r chi.Router) {
  // Historical queries
  r.Get("/traces", s.GetTraces)
  r.Get("/tasks/{task_id}", s.GetTask)
  r.Get("/tasks/{task_id}/tree", s.GetTaskTree)
  r.Get("/sessions/{session_id}/summary", s.GetSessionSummary)

  // Real-time streaming (SSE)
  r.Get("/stream", s.StreamTraces)
 })

 // Health check
 s.router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
  w.WriteHeader(http.StatusOK)
  w.Write([]byte("OK"))
 })
}

func (s *Server) ListenAndServe(addr string) error {
 s.server = &http.Server{
  Addr:         addr,
  Handler:      s.router,
  ReadTimeout:  15 * time.Second,
  WriteTimeout: 0, // Disabled for SSE
  IdleTimeout:  60 * time.Second,
 }
 return s.server.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
 return s.server.Shutdown(ctx)
}
```text

### 5. REST Handlers

**File:** `internal/api/handlers.go`

```go
package api

import (
 "encoding/json"
 "net/http"
 "strconv"

 "github.com/go-chi/chi/v5"
)

type TracesResponse struct {
 Traces []storage.TraceEvent `json:"traces"`
 Total  int                  `json:"total"`
 Limit  int                  `json:"limit"`
 Offset int                  `json:"offset"`
}

func (s *Server) GetTraces(w http.ResponseWriter, r *http.Request) {
 // Parse query parameters
 sessionID := r.URL.Query().Get("session_id")
 taskID := r.URL.Query().Get("task_id")
 toolName := r.URL.Query().Get("tool_name")
 from := r.URL.Query().Get("from")
 to := r.URL.Query().Get("to")

 limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
 if limit == 0 {
  limit = 100
 }
 offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

 // Query database
 traces, total, err := s.db.QueryTraces(r.Context(), storage.QueryParams{
  SessionID: sessionID,
  TaskID:    taskID,
  ToolName:  toolName,
  From:      from,
  To:        to,
  Limit:     limit,
  Offset:    offset,
 })
 if err != nil {
  http.Error(w, err.Error(), http.StatusInternalServerError)
  return
 }

 // Return JSON
 w.Header().Set("Content-Type", "application/json")
 json.NewEncoder(w).Encode(TracesResponse{
  Traces: traces,
  Total:  total,
  Limit:  limit,
  Offset: offset,
 })
}

func (s *Server) GetTask(w http.ResponseWriter, r *http.Request) {
 taskID := chi.URLParam(r, "task_id")

 task, err := s.db.GetAggregatedTask(r.Context(), taskID)
 if err != nil {
  http.Error(w, err.Error(), http.StatusNotFound)
  return
 }

 w.Header().Set("Content-Type", "application/json")
 json.NewEncoder(w).Encode(map[string]interface{}{
  "task": task,
 })
}

func (s *Server) GetTaskTree(w http.ResponseWriter, r *http.Request) {
 taskID := chi.URLParam(r, "task_id")

 tree, err := s.db.GetTaskTree(r.Context(), taskID)
 if err != nil {
  http.Error(w, err.Error(), http.StatusNotFound)
  return
 }

 w.Header().Set("Content-Type", "application/json")
 json.NewEncoder(w).Encode(tree)
}

func (s *Server) GetSessionSummary(w http.ResponseWriter, r *http.Request) {
 sessionID := chi.URLParam(r, "session_id")

 summary, err := s.db.GetSessionSummary(r.Context(), sessionID)
 if err != nil {
  http.Error(w, err.Error(), http.StatusNotFound)
  return
 }

 w.Header().Set("Content-Type", "application/json")
 json.NewEncoder(w).Encode(summary)
}
```text

### 6. File Watcher & Indexer

**File:** `internal/indexer/watcher.go`

Watches JSONL files and broadcasts new events to SSE clients.

```go
package indexer

import (
 "bufio"
 "context"
 "encoding/json"
 "fmt"
 "log/slog"
 "os"
 "path/filepath"
 "time"

 "github.com/fsnotify/fsnotify"

 "github.com/yourusername/claude-trace-server/internal/broker"
 "github.com/yourusername/claude-trace-server/internal/storage"
)

type Indexer struct {
 db     *storage.DB
 broker *broker.Broker
}

func NewIndexer(db *storage.DB, broker *broker.Broker) *Indexer {
 return &Indexer{
  db:     db,
  broker: broker,
 }
}

func (idx *Indexer) Watch(ctx context.Context, traceDir string) error {
 if traceDir == "" {
  homeDir, _ := os.UserHomeDir()
  traceDir = filepath.Join(homeDir, ".claude", "traces")
 }

 // Create watcher
 watcher, err := fsnotify.NewWatcher()
 if err != nil {
  return fmt.Errorf("create watcher: %w", err)
 }
 defer watcher.Close()

 // Watch directory
 if err := watcher.Add(traceDir); err != nil {
  return fmt.Errorf("watch directory: %w", err)
 }

 slog.Info("watching for trace files", "dir", traceDir)

 // Process existing files
 if err := idx.indexExistingFiles(ctx, traceDir); err != nil {
  slog.Error("failed to index existing files", "error", err)
 }

 // Watch for new events
 for {
  select {
  case event := <-watcher.Events:
   if event.Op&fsnotify.Write == fsnotify.Write {
    // File was modified (new line appended)
    if err := idx.indexFile(ctx, event.Name); err != nil {
     slog.Error("failed to index file", "file", event.Name, "error", err)
    }
   }

  case err := <-watcher.Errors:
   slog.Error("watcher error", "error", err)

  case <-ctx.Done():
   return ctx.Err()
  }
 }
}

func (idx *Indexer) indexExistingFiles(ctx context.Context, dir string) error {
 entries, err := os.ReadDir(dir)
 if err != nil {
  return err
 }

 for _, entry := range entries {
  if entry.IsDir() || filepath.Ext(entry.Name()) != ".jsonl" {
   continue
  }

  filePath := filepath.Join(dir, entry.Name())
  if err := idx.indexFile(ctx, filePath); err != nil {
   slog.Error("failed to index existing file", "file", filePath, "error", err)
  }
 }

 return nil
}

func (idx *Indexer) indexFile(ctx context.Context, filePath string) error {
 file, err := os.Open(filePath)
 if err != nil {
  return err
 }
 defer file.Close()

 scanner := bufio.NewScanner(file)
 lineNum := 0

 for scanner.Scan() {
  lineNum++
  line := scanner.Text()
  if line == "" {
   continue
  }

  var event storage.TraceEvent
  if err := json.Unmarshal([]byte(line), &event); err != nil {
   slog.Error("failed to parse trace", "line", lineNum, "error", err)
   continue
  }

  // Insert into database
  if err := idx.db.InsertTrace(ctx, &event); err != nil {
   // Duplicate span_id is okay (idempotent)
   if !isDuplicateError(err) {
    slog.Error("failed to insert trace", "span_id", event.SpanID, "error", err)
   }
   continue
  }

  // Broadcast to SSE clients (THIS IS THE MAGIC)
  idx.broker.Broadcast(&event)

  slog.Debug("indexed trace", "span_id", event.SpanID, "event_type", event.EventType)
 }

 return scanner.Err()
}

func isDuplicateError(err error) bool {
 // Check for SQLite UNIQUE constraint error
 return err != nil && (
  err.Error() == "UNIQUE constraint failed: traces.span_id" ||
  err.Error() == "constraint failed")
}
```text

### 7. SQLite Storage

**File:** `internal/storage/db.go`

```go
package storage

import (
 "context"
 "database/sql"
 "fmt"

 _ "github.com/mattn/go-sqlite3" // SQLite driver
)

type DB struct {
 conn *sql.DB
}

func NewDB(ctx context.Context, dbPath string) (*DB, error) {
 conn, err := sql.Open("sqlite3", dbPath)
 if err != nil {
  return nil, fmt.Errorf("open database: %w", err)
 }

 // Configure for concurrency
 conn.SetMaxOpenConns(1) // SQLite single writer
 conn.SetMaxIdleConns(1)

 // Enable WAL mode for concurrent reads
 if _, err := conn.ExecContext(ctx, "PRAGMA journal_mode=WAL"); err != nil {
  return nil, fmt.Errorf("enable WAL: %w", err)
 }

 db := &DB{conn: conn}

 // Run migrations
 if err := db.migrate(ctx); err != nil {
  return nil, fmt.Errorf("migrate: %w", err)
 }

 return db, nil
}

func (db *DB) Close() error {
 return db.conn.Close()
}

func (db *DB) migrate(ctx context.Context) error {
 schema := `
 CREATE TABLE IF NOT EXISTS traces (
  span_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_id TEXT,
  session_id TEXT NOT NULL,
  task_id TEXT,
  task_status TEXT,
  timestamp INTEGER NOT NULL,
  duration_ms INTEGER,
  event_type TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  tool_name TEXT,
  tool_input JSON,
  tool_output JSON,
  metrics JSON,
  tags JSON,
  metadata JSON,

  indexed_at INTEGER DEFAULT (unixepoch())
 );

 CREATE INDEX IF NOT EXISTS idx_trace_id ON traces(trace_id);
 CREATE INDEX IF NOT EXISTS idx_session_id ON traces(session_id);
 CREATE INDEX IF NOT EXISTS idx_task_id ON traces(task_id);
 CREATE INDEX IF NOT EXISTS idx_timestamp ON traces(timestamp);
 CREATE INDEX IF NOT EXISTS idx_tool_name ON traces(tool_name);
 `

 if _, err := db.conn.ExecContext(ctx, schema); err != nil {
  return err
 }

 return nil
}
```text

---

## Running the Server

### Build & Start

```bash
# Build
cd claude-trace-server
make build

# Start server
./bin/server
# Output: starting server addr=:8080

# Or with custom trace directory
CLAUDE_TRACE_DIR=/path/to/traces ./bin/server
```text

### Test SSE Connection

```bash
# Test SSE stream with curl
curl -N http://localhost:8080/api/stream

# Filter by session
curl -N http://localhost:8080/api/stream?session_id=abc123

# You'll see events as they arrive:
event: trace
data: {"span_id":"s1","trace_id":"t1","event_type":"post_tool_use",...}

event: heartbeat
data: {"timestamp":"2026-01-31T10:15:30Z"}
```text

### Test REST API

```bash
# Get recent traces
curl http://localhost:8080/api/traces?limit=10

# Get specific task
curl http://localhost:8080/api/tasks/NOV-123

# Get session summary
curl http://localhost:8080/api/sessions/abc123/summary
```text

---

## Performance Optimizations

### 1. Connection Limits

```go
// Limit concurrent SSE connections
var maxConnections = 100

func (s *Server) StreamTraces(w http.ResponseWriter, r *http.Request) {
 if len(s.broker.clients) >= maxConnections {
  http.Error(w, "too many connections", http.StatusTooManyRequests)
  return
 }
 // ... rest of handler
}
```text

### 2. SQLite WAL Mode

Already enabled in `NewDB()`:

```go
conn.ExecContext(ctx, "PRAGMA journal_mode=WAL")
```text

Benefits:

- Concurrent readers don't block
- Writers don't block readers
- ~2x read performance

### 3. Batch Inserts (Future Enhancement)

```go
func (db *DB) InsertTracesBatch(ctx context.Context, events []*TraceEvent) error {
 tx, err := db.conn.BeginTx(ctx, nil)
 if err != nil {
  return err
 }
 defer tx.Rollback()

 stmt, err := tx.PrepareContext(ctx, "INSERT INTO traces (...) VALUES (...)")
 if err != nil {
  return err
 }
 defer stmt.Close()

 for _, event := range events {
  if _, err := stmt.ExecContext(ctx, event.ToArgs()...); err != nil {
   return err
  }
 }

 return tx.Commit()
}
```text

---

## Deployment

### Systemd Service

**File:** `/etc/systemd/system/claude-trace-server.service`

```ini
[Unit]
Description=Claude Trace Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/claude-trace-server
ExecStart=/home/youruser/claude-trace-server/bin/server
Restart=on-failure
Environment="CLAUDE_TRACE_DIR=/home/youruser/.claude/traces"

[Install]
WantedBy=multi-user.target
```text

```bash
sudo systemctl enable claude-trace-server
sudo systemctl start claude-trace-server
sudo systemctl status claude-trace-server
```text

### Docker (Optional)

```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o server ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
```text

---

## Security Considerations

### 1. CORS Configuration

For production, restrict origins:

```go
cors.Handler(cors.Options{
 AllowedOrigins: []string{"https://yourdomain.com"},
 // ...
})
```text

### 2. Optional Authentication

Add Bearer token middleware:

```go
func AuthMiddleware(next http.Handler) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  token := r.Header.Get("Authorization")
  if token != "Bearer "+os.Getenv("API_TOKEN") {
   http.Error(w, "unauthorized", http.StatusUnauthorized)
   return
  }
  next.ServeHTTP(w, r)
 })
}
```text

### 3. Rate Limiting

```go
import "golang.org/x/time/rate"

var limiter = rate.NewLimiter(rate.Limit(100), 200) // 100 req/s, burst 200

func RateLimitMiddleware(next http.Handler) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  if !limiter.Allow() {
   http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
   return
  }
  next.ServeHTTP(w, r)
 })
}
```text

---

## Monitoring & Debugging

### Structured Logging

Already using `slog`:

```go
slog.Info("event broadcast", "span_id", event.SpanID, "clients", len(broker.clients))
slog.Error("failed to parse trace", "line", lineNum, "error", err)
```text

### Metrics Endpoint

```go
func (s *Server) GetMetrics(w http.ResponseWriter, r *http.Request) {
 s.broker.mu.RLock()
 clientCount := len(s.broker.clients)
 s.broker.mu.RUnlock()

 w.Header().Set("Content-Type", "application/json")
 json.NewEncoder(w).Encode(map[string]interface{}{
  "connected_clients": clientCount,
  "uptime_seconds":    time.Since(startTime).Seconds(),
 })
}
```text

---

## Testing SSE

### Manual Test Script

```bash
#!/bin/bash
# test-sse.sh

echo "Starting SSE connection..."
curl -N http://localhost:8080/api/stream &
CURL_PID=$!

# Simulate trace events
sleep 2
echo "Triggering hook to generate traces..."
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}' | \
  ~/.claude/hooks/claude-trace

sleep 2
echo "Stopping SSE connection..."
kill $CURL_PID
```text

### Browser Test

Open browser console:

```javascript
const eventSource = new EventSource('http://localhost:8080/api/stream');

eventSource.addEventListener('trace', (e) => {
  console.log('Trace:', JSON.parse(e.data));
});

eventSource.addEventListener('heartbeat', (e) => {
  console.log('Heartbeat:', JSON.parse(e.data));
});

eventSource.onerror = (e) => {
  console.error('SSE error:', e);
};
```text

---

## Future Enhancements

### Phase 2

- Prometheus metrics export
- Distributed tracing with OpenTelemetry
- Query result caching

### Phase 3

- Multi-node deployment with Redis pub/sub
- Time-series database migration (ClickHouse)
- Advanced analytics endpoints

---

## References

- [Unified Architecture](./05-unified-architecture.md) - **System overview** - How all components integrate
- [Data Contracts](./01-data-contracts.md) - API contracts and schemas
- [Hook Specification](./02-hook-specification.md) - Trace event generation
- [Go Chi Router](https://github.com/go-chi/chi) - HTTP routing
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
