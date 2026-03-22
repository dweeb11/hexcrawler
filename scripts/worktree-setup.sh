#!/usr/bin/env bash
# Worktree setup script — run after creating a worktree to make the game playable.
# Called automatically via WorktreeCreate hook in .claude/settings.json.

set -e

# 1. Install dependencies
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# 2. Optionally copy .env.local from the main worktree for full Turso support
MAIN_WORKTREE=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
if [ -f "$MAIN_WORKTREE/.env.local" ] && [ ! -f .env.local ]; then
  cp "$MAIN_WORKTREE/.env.local" .env.local
  echo "Copied .env.local from main worktree (Turso API available)"
else
  echo "No .env.local — API will use local SQLite (file:local.db)"
fi

# 3. Seed the local database if no .env.local (so encounters exist locally)
if [ ! -f .env.local ]; then
  echo "Seeding local database..."
  npx tsx scripts/seed-local.ts
fi

echo ""
echo "Ready — run 'npm run dev' to play (localhost:5173)"
