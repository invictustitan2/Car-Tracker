#!/bin/bash
# UPS Package Car Tracker Dev Shell
# Tailored helper functions for the Vite + React project

# Detect if being sourced or executed
SCRIPT_MODE="sourced"
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  SCRIPT_MODE="executed"
  set -euo pipefail
else
  set +u 2>/dev/null || true
fi

export UPS_TRACKER_ROOT="/home/dreamboat/projects/ups-tracker"
export UPS_TRACKER_DATA_KEY="ups-tracker-data"
export UPS_TRACKER_DOC_POLICY="Keep similar docs together; extend existing playbooks before creating new ones."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

ups_echo() {
  local color="$1"; shift
  echo -e "${color}$*${NC}"
}

ups_cd_root() {
  cd "$UPS_TRACKER_ROOT" || {
    ups_echo "$RED" "Unable to enter $UPS_TRACKER_ROOT"
    return 1
  }
}

ups_status() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Project root: $UPS_TRACKER_ROOT"
  ups_echo "$CYAN" "Node version: $(node -v 2>/dev/null || echo 'n/a')"
  ups_echo "$CYAN" "npm version: $(npm -v 2>/dev/null || echo 'n/a')"
  ups_echo "$CYAN" "Git status:"
  git status -sb
}

ups_install() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Installing dependencies"
  npm install
}

ups_dev() {
  ups_cd_root || return 1
  ups_echo "$GREEN" "Starting Vite dev server"
  npm run dev
}

ups_test() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Running Vitest (jsdom)"
  timeout 120s npm test -- --run "$@"
}

ups_build() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Building production bundle"
  npm run build
}

ups_preview() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Previewing dist bundle"
  npm run preview
}

ups_release() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Creating release archive..."
  bash "$UPS_TRACKER_ROOT/scripts/make-release-zip.sh"
}

ups_deploy() {
  ups_cd_root || return 1
  ups_echo "$YELLOW" "Deploying via npm run deploy"
  npm run deploy
}

ups_deploy_dirty() {
  ups_cd_root || return 1
  ups_echo "$YELLOW" "Deploying (dirty) via npm run deploy:dirty"
  npm run deploy:dirty
}

ups_deploy_prod() {
  ups_cd_root || return 1
  ups_echo "$YELLOW" "Deploying to production environment"
  ups_release && npx wrangler pages deploy dist --project-name ups-tracker --branch production
}

ups_doc_policy() {
  ups_echo "$MAGENTA" "Documentation Cohesion Policy"
  cat <<EOF
${UPS_TRACKER_DOC_POLICY}
- No exponential doc sprawl: consolidate updates into the primary README or existing guides.
- Only create a new doc when scope cannot fit the established references.
- Prefer updating TODO.md and README.md over creating new files.
EOF
}

ups_patch() {
  ups_cd_root || return 1
  bash "$UPS_TRACKER_ROOT/scripts/make-patch.sh"
}

ups_todo() {
  ups_cd_root || return 1
  if [ -f "$UPS_TRACKER_ROOT/TODO.md" ]; then
    cat "$UPS_TRACKER_ROOT/TODO.md"
  else
    ups_echo "$YELLOW" "TODO.md not found"
  fi
}

ups_audit() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "=== RUTHLESS AUDIT SUMMARY ==="
  if [ -f "$UPS_TRACKER_ROOT/RUTHLESS_AUDIT.md" ]; then
    grep -A 5 "EXECUTIVE SUMMARY" "$UPS_TRACKER_ROOT/RUTHLESS_AUDIT.md" | head -20
    echo ""
    ups_echo "$CYAN" "=== PRODUCTION READINESS ==="
    grep "Overall Production Readiness:" "$UPS_TRACKER_ROOT/RUTHLESS_AUDIT.md"
    echo ""
    ups_echo "$YELLOW" "Full audit: cat RUTHLESS_AUDIT.md"
  else
    ups_echo "$RED" "RUTHLESS_AUDIT.md not found"
  fi
}

ups_docs_consolidate() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Consolidating contradictory documentation..."
  
  # Create docs archive directory
  mkdir -p docs/archive
  
  # Move outdated/conflicting docs to archive
  local archive_docs=(
    "BACKEND_INTEGRATION_COMPLETE.md"
    "FEATURE_AUDIT.md"
    "INTEGRATION_PLAN.md"
    "SYNC_IMPLEMENTATION.md"
    "SYNC_STATUS.md"
    "DIAGNOSTICS_IMPLEMENTATION.md"
    "WEBSOCKET_PUSH_IMPLEMENTATION.md"
    "TESTING_IMPLEMENTATION.md"
  )
  
  for doc in "${archive_docs[@]}"; do
    if [ -f "$doc" ]; then
      ups_echo "$YELLOW" "Archiving $doc"
      mv "$doc" "docs/archive/"
    fi
  done
  
  ups_echo "$GREEN" "Archived conflicting/outdated docs to docs/archive/"
  ups_echo "$CYAN" "Active docs: README.md, RUTHLESS_AUDIT.md, DEPLOYMENT.md, CHANGELOG.md, TESTING.md"
}

ups_test_fix() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Fixing disabled unit tests..."
  ups_echo "$YELLOW" "Updating tests in src/PackageCarTracker.test.jsx"
  # Will be implemented by code changes
}

ups_e2e() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Running E2E tests with Playwright"

  local timeout_seconds="${PLAYWRIGHT_TIMEOUT:-480}"

  if [[ "${UPS_SKIP_LOCAL_WORKER:-0}" == "1" ]]; then
    ups_echo "$YELLOW" "UPS_SKIP_LOCAL_WORKER=1 detected – assuming external API is available"
    timeout "${timeout_seconds}s" npx playwright test "$@"
    return $?
  fi

  PLAYWRIGHT_TIMEOUT="$timeout_seconds" bash "$UPS_TRACKER_ROOT/scripts/run-e2e-with-worker.sh" "$@"
}

ups_e2e_ui() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Opening Playwright UI mode"
  npx playwright test --ui
}

ups_coverage() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Running tests with coverage"
  npm test -- --coverage
}

ups_lint_fix() {
  ups_cd_root || return 1
  ups_echo "$CYAN" "Running ESLint with auto-fix"
  npm run lint -- --fix
}

ups_clean() {
  ups_cd_root || return 1
  ups_echo "$YELLOW" "Cleaning build artifacts and caches"
  rm -rf dist coverage playwright-report test-results .vite node_modules/.vite
  ups_echo "$GREEN" "Clean complete"
}

ups_help() {
  cat <<'EOF'
UPS Tracker Dev Shell Commands
==============================
DEVELOPMENT:
  ups_status                # show node/npm versions and git status
  ups_install               # npm install
  ups_dev                   # npm run dev
  ups_test [args]           # npm test -- --run
  ups_test_fix              # fix disabled unit tests
  ups_coverage              # run tests with coverage report
  ups_e2e [args]            # run Playwright E2E tests
  ups_e2e_ui                # open Playwright UI mode
  ups_lint_fix              # run ESLint with auto-fix
  ups_clean                 # remove build artifacts and caches

BUILD & DEPLOY:
  ups_build                 # npm run build
  ups_preview               # npm run preview
  ups_release               # run lint, test, build, and zip release
  ups_deploy                # npm run deploy (preview)
  ups_deploy_dirty          # npm run deploy:dirty (for dirty tree)
  ups_deploy_prod           # release and deploy to production

DOCUMENTATION:
  ups_audit                 # show production readiness summary
  ups_todo                  # print TODO.md
  ups_docs_consolidate      # archive outdated/conflicting docs
  ups_doc_policy            # review documentation cohesion policy
  ups_patch                 # rebuild /tmp/ups-tracker.patch diff

MISC:
  ups_help                  # show this help
EOF
}

ups_echo "$GREEN" "UPS Tracker Dev Shell ready. Type ups_help for commands."
ups_echo "$YELLOW" "Doc Cohesion / No Doc Sprawl: ${UPS_TRACKER_DOC_POLICY}"

# If executed (not sourced), start interactive shell
if [[ "$SCRIPT_MODE" == "executed" ]]; then
  ups_echo "$CYAN" "Dev shell started in interactive mode. Type 'exit' to quit."
  exec /bin/bash --rcfile <(echo "source '$BASH_SOURCE'; ups_status")
fi