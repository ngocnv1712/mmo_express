#!/bin/bash

# MMO Express Sidecar Stop Script
PORT=3456

echo "🛑 Stopping MMO Express Sidecar..."

# Kill by port
fuser -k $PORT/tcp 2>/dev/null

# Kill by name
pkill -f "node.*sidecar.*index" 2>/dev/null

sleep 1

if lsof -i:$PORT -t >/dev/null 2>&1; then
    echo "   Force killing..."
    lsof -i:$PORT -t | xargs kill -9 2>/dev/null
fi

echo "✅ Sidecar stopped"
