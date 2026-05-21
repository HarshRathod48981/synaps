#!/bin/bash
# update.sh
# Run this on your NAS to pull and build the latest changes

set -e

echo "🔄 Updating Synaps..."

# Pull latest changes
git pull origin main

# Update backend dependencies
echo "📦 Updating backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Update and build frontend
echo "📦 Updating frontend..."
cd frontend
npm install
echo "🏗 Building optimized frontend for production..."
npm run build
cd ..

# Restart services
echo "🔄 Restarting systemd services..."
if systemctl list-unit-files | grep -q synaps-backend; then
    sudo systemctl restart synaps-backend
    sudo systemctl restart synaps-frontend
    echo "✅ Update complete! Synaps is back online."
else
    echo "⚠️ Systemd services not found. You can start the app manually:"
    echo "   ./start-prod.sh"
fi
