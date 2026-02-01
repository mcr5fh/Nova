#!/bin/bash
# Monitor nova orchestrator in real-time

echo "🔍 Monitoring Nova Orchestrator"
echo "================================"
echo ""

# Find the most recent run directory
LATEST_RUN=$(ls -td runs/*/ 2>/dev/null | head -1)

if [ -n "$LATEST_RUN" ]; then
    echo "📊 Tailing trace log: ${LATEST_RUN}trace.jsonl"
    echo ""
    tail -f "${LATEST_RUN}trace.jsonl" | jq -r '. | "\(.timestamp | split(".")[0]) [\(.event_type)] \(.message // .task_id)"'
else
    echo "⏳ Waiting for run to start..."
    # Watch for new runs
    while [ ! -d "runs" ] || [ -z "$(ls -A runs 2>/dev/null)" ]; do
        sleep 1
    done
    exec "$0"
fi
