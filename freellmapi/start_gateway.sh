#!/bin/bash
cd "/Users/macbookair/Documents/my projects/Jarvis/freellmapi/server"
export PORT=3001
export NODE_ENV=production
exec /usr/local/bin/node dist/index.js
