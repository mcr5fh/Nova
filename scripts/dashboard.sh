#!/bin/bash
# Live dashboard for Nova orchestrator

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           🚀 Nova Orchestrator Dashboard                  ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    # Show recent trace events
    LATEST_RUN=$(ls -td runs/*/ 2>/dev/null | head -1)
    if [ -n "$LATEST_RUN" ]; then
        echo "📊 Latest Events (${LATEST_RUN})"
        echo "─────────────────────────────────────────────────────────────"
        tail -5 "${LATEST_RUN}trace.jsonl" 2>/dev/null | jq -r '. | "\(.event_type | .[0:20]) │ \(.message // .task_id | .[0:40])"' || echo "No events yet"
        echo ""

        echo "📈 Run Summary"
        echo "─────────────────────────────────────────────────────────────"
        if [ -f "${LATEST_RUN}run.json" ]; then
            jq -r '"Tasks: \(.total_tasks // 0) | Completed: \(.completed_tasks // 0) | Failed: \(.failed_tasks // 0)"' "${LATEST_RUN}run.json"
        else
            echo "In progress..."
        fi
        echo ""
    fi

    # Show open beads
    echo "🎯 Active Tasks (Beads)"
    echo "─────────────────────────────────────────────────────────────"
    bd list --status=open 2>/dev/null | head -10 || echo "No open tasks"
    echo ""
    echo "Press Ctrl+C to exit | Refreshing every 2s..."

    sleep 2
done
