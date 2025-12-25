#!/bin/bash

# Function to kill process on port
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port)
  if [ -n "$pid" ]; then
    echo "Killing process on port $port (PID: $pid)..."
    kill -9 $pid
  fi
}

# Cleanup existing processes
echo "Cleaning up ports 5001 and 5173..."
kill_port 5001
kill_port 5173

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "Starting Backend Server..."
cd server && npm start &
SERVER_PID=$!

echo "Starting Frontend..."
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $SERVER_PID $FRONTEND_PID
