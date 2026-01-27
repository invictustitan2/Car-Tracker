#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

PATCH_PATH="/tmp/ups-tracker.patch"
git diff > "$PATCH_PATH"

echo "Saved working diff to $PATCH_PATH"
echo "Share this patch alongside preview links for quick reviews."
