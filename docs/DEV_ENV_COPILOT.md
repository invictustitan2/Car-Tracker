# Dev Environment – Copilot & Agents

This project uses **GitHub Copilot Chat** and local prompt files to speed up development while keeping tests, docs, and production behavior honest.

For a full list of dev shell commands, npm scripts, VS Code tasks, and Copilot prompt workflows, see:
- `docs/COMMANDS_REFERENCE.md`

## Canonical Instructions

- The main instructions for AI agents live in:
  - `.github/instructions/ups-tracker.instructions.md`
- The lightweight index (for tools to discover the canonical file) is:
  - `.github/copilot-instructions.md`

Always read the canonical instructions file before making non-trivial changes.

Agents working in this repo should assume they are expected to **execute commands and edits directly** (dev-shell `ups_*` commands, VS Code tasks, non-destructive scripts) as part of answering, and only pause to confirm when a step is clearly destructive (data wipes, production deploys) or when choosing between competing architectural/product directions.

## Prompt Files

Prompt files live under `.github/prompts` and are registered via workspace settings so Copilot Chat can use them directly.

- `/ups-dev-cycle` – Main development workflow
  - Use for implementing new features, fixing bugs, and making refactors.
  - Follows the dev shell (`dev-shell.sh`), testing, and docs-update workflow.

- `/ups-e2e-doctor` – Playwright E2E troubleshooting
  - Use when Playwright E2E tests fail or behave strangely.
  - Focuses on `ups_e2e`, `playwright-report/results.json`, and mapping failures back to components and selectors.

- `/ups-cf-and-services-arch` – Cloudflare + additional services architecture planning
  - Use when considering scaling, background jobs, analytics, or new services.
  - Always proposes at least one Cloudflare-native option and one option using an additional service (e.g., AWS), with pros/cons and migration steps.

- `/ups-docs-tests-sync` – Keep code, tests, and docs aligned
  - Use after significant code changes or when reviewing diffs.
  - Ensures Vitest/Playwright tests and docs (`IMPLEMENTATION_STATUS.md`, `PRODUCTION_READY_STATUS.md`, `DEPLOYMENT_COMPLETE.md`, `TESTING.md`, security docs) stay in sync.

- `/ups-quick-edit` – Local, small refactors
  - Use for focused changes in the current file/selection (renames, extraction, small bug fixes) without cross-file architecture changes.

## VS Code Integration

The workspace config under `.vscode/` wires Copilot and tasks to the dev shell:

- `.vscode/tasks.json` defines tasks that run:
  - `ups: dev` → `bash -lc "source ./dev-shell.sh && ups_dev"`
  - `ups: unit tests` → `bash -lc "source ./dev-shell.sh && ups_test"`
  - `ups: e2e tests` → `bash -lc "source ./dev-shell.sh && ups_e2e"`
  - `ups: coverage` → `bash -lc "source ./dev-shell.sh && ups_coverage"`
  - `ups: lint+fix` → `bash -lc "source ./dev-shell.sh && ups_lint_fix"`

- `.vscode/settings.json` registers prompt files:
  - `"chat.promptFilesLocations": [".github/prompts"]`

These tasks and settings are designed to work over **Remote-SSH on AN3** and from iPhone SSH/RDP sessions (no GUI assumptions).

## How to Use This as the Solo Maintainer

- For day-to-day coding:
  - Open Copilot Chat and start with the `/ups-dev-cycle` prompt.
  - Run tests and dev flows via VS Code tasks or directly:
    - `source dev-shell.sh`
    - `ups_test`, `ups_e2e`, `ups_coverage`, `ups_lint_fix`

- When E2E tests fail:
  - Use `/ups-e2e-doctor` to analyze `playwright-report/results.json` and map failures back to components and specs.

- When thinking about bigger changes (Cloudflare vs AWS/other services):
  - Use `/ups-cf-and-services-arch` to explore options and get a staged migration plan before touching code.

- After a meaningful change lands:
  - Use `/ups-docs-tests-sync` to make sure tests and docs reflect the new behavior.

- For fast, local cleanups:
  - Use `/ups-quick-edit` on the current file or selection, keeping scope small and reversible.

Keep this file short and treat `.github/instructions/ups-tracker.instructions.md` as the source of truth for detailed rules.
