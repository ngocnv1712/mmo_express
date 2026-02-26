#!/bin/bash

# MMO Express Sidecar Restart Script
# Usage: ./restart.sh

SIDECAR_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3456
LOG_FILE="/tmp/sidecar.log"

echo "🔄 Restarting MMO Express Sidecar..."

# Kill any process using port 3456
echo "   Stopping old processes..."
fuser -k $PORT/tcp 2>/dev/null
sleep 1

# Double check - kill by process name
pkill -f "node.*sidecar.*index" 2>/dev/null
pkill -f "node $SIDECAR_DIR/index.js" 2>/dev/null
sleep 1

# Verify port is free
if lsof -i:$PORT -t >/dev/null 2>&1; then
    echo "❌ Port $PORT still in use. Force killing..."
    lsof -i:$PORT -t | xargs kill -9 2>/dev/null
    sleep 1
fi

# Start sidecar
echo "   Starting sidecar..."
cd "$SIDECAR_DIR"
node index.js > "$LOG_FILE" 2>&1 &
SIDECAR_PID=$!

# Wait for startup
sleep 2

# Verify running
if curl -s http://localhost:$PORT -X POST -H "Content-Type: application/json" -d '{"action":"ping"}' | grep -q "pong\|success"; then
    echo "✅ Sidecar started successfully (PID: $SIDECAR_PID)"
    echo "   Log: $LOG_FILE"

    # Show loaded actions count
    ACTION_COUNT=$(curl -s http://localhost:$PORT -X POST -H "Content-Type: application/json" -d '{"action":"getActionSchemas"}' | grep -o '"type"' | wc -l)
    echo "   Actions loaded: $ACTION_COUNT"
else
    echo "❌ Sidecar failed to start. Check log:"
    tail -20 "$LOG_FILE"
    exit 1
fi
