# GitHub Copilot Instructions for `ups-tracker` (Index)

This file is a **lightweight index** for Copilot and other tools. The **canonical, detailed instructions** live in `.github/instructions/ups-tracker.instructions.md`. All AI coding agents and automations working in this repo MUST read that canonical file first.

## Quick Reference

- **Architecture:** React/Vite frontend (`src/`), Cloudflare Workers backend (`workers/`)
- **Dev shell:** `source dev-shell.sh` → `ups_dev`, `ups_test`, `ups_e2e`, `ups_coverage`, `ups_lint_fix`, `ups_build`, `ups_deploy*`
- **Testing:** Vitest + RTL (unit), Playwright (E2E); see `TESTING.md`
- **Docs:** `IMPLEMENTATION_STATUS.md`, `PRODUCTION_READY_STATUS.md`, `DEPLOYMENT_COMPLETE.md`
- **Platform:** Cloudflare-based today; additional services (AWS/others) allowed when clearly justified and introduced via explicit APIs.

## Copilot Prompt Files

Specialized prompt files live in `.github/prompts/`:

- `/ups-dev-cycle` → Main development workflow
- `/ups-e2e-doctor` → Playwright troubleshooting
- `/ups-cf-and-services-arch` → Cloudflare + additional services architecture planning
- `/ups-docs-tests-sync` → Keep code, tests, and docs aligned
- `/ups-quick-edit` → Local file refactoring

See `docs/DEV_ENV_COPILOT.md` for detailed usage and examples.

## Where to Start

- For detailed behavioral rules and architecture guidance, open `.github/instructions/ups-tracker.instructions.md`.
- For day-to-day development with Copilot Chat, start with the `/ups-dev-cycle` prompt.
- For E2E issues, use `/ups-e2e-doctor`; for architecture questions, use `/ups-cf-and-services-arch`.