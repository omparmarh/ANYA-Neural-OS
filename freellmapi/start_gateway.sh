#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/server"
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi
export PORT=3001
export NODE_ENV=production
export FREEAPI_CONFIG_PATH="$DIR/freellmapi.config.json"
exec /usr/local/bin/node dist/index.js
