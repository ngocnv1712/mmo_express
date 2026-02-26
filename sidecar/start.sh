#!/bin/bash

# MMO Express Sidecar Start Script
SIDECAR_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3456
LOG_FILE="/tmp/sidecar.log"

# Check if already running
if lsof -i:$PORT -t >/dev/null 2>&1; then
    echo "⚠️  Sidecar already running on port $PORT"
    echo "   Use ./restart.sh to restart or ./stop.sh to stop"
    exit 1
fi

echo "🚀 Starting MMO Express Sidecar..."
cd "$SIDECAR_DIR"
node index.js > "$LOG_FILE" 2>&1 &
SIDECAR_PID=$!

sleep 2

if curl -s http://localhost:$PORT -X POST -H "Content-Type: application/json" -d '{"action":"ping"}' | grep -q "pong\|success"; then
    echo "✅ Sidecar started (PID: $SIDECAR_PID)"
    echo "   Log: $LOG_FILE"
else
    echo "❌ Failed to start. Check: tail -f $LOG_FILE"
    exit 1
fi
