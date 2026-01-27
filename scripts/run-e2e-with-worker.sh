#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/.tmp"
LOG_FILE="$LOG_DIR/local-worker.log"
mkdir -p "$LOG_DIR"

ensure_local_d1_schema() {
  local db_name="${LOCAL_D1_NAME:-ups-tracker-db}"
  local migrations_dir="$ROOT_DIR/migrations"

  if [[ ! -d "$migrations_dir" ]]; then
    echo "No migrations directory at $migrations_dir; skipping D1 schema setup"
    return
  fi

  mapfile -t migrations < <(find "$migrations_dir" -maxdepth 1 -name '*.sql' | sort)

  if [[ ${#migrations[@]} -eq 0 ]]; then
    echo "No migration files discovered in $migrations_dir; skipping D1 schema setup"
    return
  fi

  echo "Ensuring local D1 schema for $db_name"
  for migration in "${migrations[@]}"; do
    echo "Applying $(basename "$migration")"
    npx wrangler d1 execute "$db_name" --local --file="$migration" >/dev/null
  done
}

ensure_local_d1_schema

# Default to local worker endpoint unless caller overrides
export VITE_API_URL="${VITE_API_URL:-http://127.0.0.1:8787}"
export VITE_API_KEY="${VITE_API_KEY:-test-api-key}"
export DISABLE_RATE_LIMIT="${DISABLE_RATE_LIMIT:-1}"
PLAYWRIGHT_TIMEOUT="${PLAYWRIGHT_TIMEOUT:-480}"

npm run dev:worker >"$LOG_FILE" 2>&1 &
WORKER_PID=$!

echo "Local worker starting (pid $WORKER_PID). Logs: $LOG_FILE"

cleanup() {
  if kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

HOST="${VITE_API_URL#http://}"
HOST="${HOST#https://}"
HOST="${HOST%%/*}"
PORT="${HOST##*:}"
if [[ "$HOST" == "$PORT" ]]; then
  PORT=80
fi
ATTEMPTS=0
MAX_ATTEMPTS=30
until curl -fsS -H "x-api-key: $VITE_API_KEY" "$VITE_API_URL/api/health" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
    echo "Local worker at $VITE_API_URL did not become healthy after $MAX_ATTEMPTS attempts. See $LOG_FILE" >&2
    exit 1
  fi
  sleep 1
  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "Local worker process exited early. See $LOG_FILE" >&2
    exit 1
  fi
  echo "Waiting for local worker (attempt $ATTEMPTS/$MAX_ATTEMPTS)..."
done

echo "Local worker ready at $VITE_API_URL"

timeout "${PLAYWRIGHT_TIMEOUT}s" npx playwright test "$@"
