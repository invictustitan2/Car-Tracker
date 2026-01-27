#!/usr/bin/env bash
set -euo pipefail

if ! git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "Not inside a git repository."
  exit 1
fi

cd "$git_root"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip utility not found. Install zip and retry."
  exit 1
fi

npm run release

timestamp=$(date +%Y%m%d-%H%M%S)
git_sha=$(git rev-parse --short HEAD)

# Create releases directory if it doesn't exist
mkdir -p "$git_root/releases"

archive_path="$git_root/releases/ups-tracker-release-${timestamp}-${git_sha}.zip"

zip -r "$archive_path" . \
  -x "./node_modules/*" \
     "./.git/*" \
     "./dist/*.map" \
     "./dist/.vite/*" \
     "./coverage/*" \
     "./logs/*" \
     "./.wrangler/state/*" \
     "./*.log" \
     "./releases/*"

echo "Release archive created at $archive_path"
