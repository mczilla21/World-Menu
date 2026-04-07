#!/bin/bash
# World Menu - Production Start Script
# Uses PM2 for auto-restart and process management

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Create logs directory
mkdir -p logs

# Build client if dist doesn't exist
if [ ! -d "client/dist" ]; then
  echo "Building client..."
  cd client && npx vite build && cd ..
  # Copy public assets
  cp client/public/manifest.json client/dist/ 2>/dev/null || true
  cp client/public/icon-*.png client/dist/ 2>/dev/null || true
  cp client/public/embed.js client/dist/ 2>/dev/null || true
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# Stop existing instance if running
pm2 stop world-menu 2>/dev/null || true
pm2 delete world-menu 2>/dev/null || true

# Start with PM2
pm2 start ecosystem.config.cjs

echo ""
echo "========================================="
echo "  World Menu is running!"
echo "  http://localhost:${PORT:-3000}"
echo "========================================="
echo ""
echo "Commands:"
echo "  pm2 logs world-menu    - View logs"
echo "  pm2 restart world-menu - Restart"
echo "  pm2 stop world-menu    - Stop"
echo "  pm2 monit              - Monitor"
echo ""
