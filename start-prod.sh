#!/bin/bash
# start-prod.sh
# Production startup script if not using systemd

set -e

echo "🚀 Starting Synaps in Production Mode..."

# Start backend optimized for single-core/low-power
echo "🔧 Starting FastAPI backend on port 8000..."
cd backend
source venv/bin/activate
# Using 1 worker for Core2Duo to save RAM and context switching overhead
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 2

# Start optimized frontend
echo "🎨 Starting Next.js frontend on port 3000..."
cd frontend
npm run start &
FRONTEND_PID=$!
cd ..

echo "✅ Synaps is running in PRODUCTION mode."
echo "Press Ctrl+C to stop."

# Handle cleanup
cleanup() {
    echo ""
    echo "Stopping Synaps..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
