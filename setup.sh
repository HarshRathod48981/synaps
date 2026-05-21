#!/bin/bash
# Synaps — Setup Script
# Run this once to set up the development environment

set -e

echo "╔══════════════════════════════════════╗"
echo "║        Synaps — Initial Setup        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Backend setup
echo "📦 Setting up Python backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt
echo "✅ Backend dependencies installed"

cd ..

# Frontend setup
echo ""
echo "📦 Setting up Next.js frontend..."
cd frontend
npm install
echo "✅ Frontend dependencies installed"

cd ..

echo ""
echo "╔══════════════════════════════════════╗"
echo "║          Setup Complete! 🎉          ║"
echo "╠══════════════════════════════════════╣"
echo "║                                      ║"
echo "║  Start backend:                      ║"
echo "║  cd backend && source venv/bin/activate ║"
echo "║  python main.py                      ║"
echo "║                                      ║"
echo "║  Start frontend:                     ║"
echo "║  cd frontend && npm run dev          ║"
echo "║                                      ║"
echo "║  Or use: ./start.sh                  ║"
echo "║                                      ║"
echo "╚══════════════════════════════════════╝"
