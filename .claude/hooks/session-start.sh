#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR/skull-game"

# Install dependencies
npm install

# Start dev server in background if not already running
if ! pgrep -f "vite" > /dev/null 2>&1; then
  nohup npm run dev -- --host 0.0.0.0 >> /tmp/vite-dev.log 2>&1 &
  echo "Dev server starting... check /tmp/vite-dev.log for output"
fi
