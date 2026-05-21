#!/bin/bash
# deploy.sh
# Run this on your MacBook to push changes

set -e

echo "🚀 Deploying Synaps..."

# Add all changes
git add .

# Commit with a default or provided message
COMMIT_MSG=${1:-"Update Synaps"}
git commit -m "$COMMIT_MSG" || echo "No changes to commit."

# Push to origin
git push origin main

echo "✅ Push complete!"
echo "Now SSH into your NAS and run ./update.sh"
