# Ups Tracker – Canonical Copilot Instructions

## Upgrade Philosophy

- The app is in production and must remain stable for users, but **high-value upgrades and major refactors are strongly encouraged**.
- **Default to action**: Implement improvements directly unless they require breaking changes or explicit user approval.
- When making changes:
  - Keep tests and docs in sync (Vitest, Playwright, status docs).
  - For small/medium changes: implement directly with clear commit messages.
  - For large architectural changes: briefly document the approach inline or in existing docs before implementing.
- Infrastructure changes (Cloudflare, AWS, other services) should be chosen based on technical fit and operational simplicity.
- Preserve existing user paths during migrations; no big-bang cutovers without explicit approval.

---

## 0. Editor & Extensions (AN3 baseline)

- Primary editor is **VS Code** running on the AN3 machine, typically accessed via Remote-SSH.
- Common extensions that SHOULD be installed and respected:
  - Tailwind CSS IntelliSense
  - ESLint
  - Prettier
  - GitHub Copilot + GitHub Copilot Chat
  - GitLens
  - Playwright Test for VS Code
  - Cloudflare Workers
  - Markdown All in One
- Policy:
  - Reuse existing ESLint/Prettier configuration; do NOT introduce additional formatters or linters unless explicitly justified.
  - Prefer Tailwind utility classes and the existing CSS structure over adding ad-hoc stylesheets or inline styles.
  - When adding repeatable workflows, prefer **VS Code tasks** that wrap `dev-shell.sh` commands instead of adding new raw `npm` scripts.

## 1. Big-Picture Architecture

- Frontend: React + Vite + Tailwind, located under `src/`.
- Backend/API: Cloudflare Workers, located under `workers/`, using KV, D1, and Durable Objects where appropriate.
- Current runtime is **Cloudflare Pages + Workers**; prefer reusing this existing infrastructure when it is sufficient for the use case.
- New services MAY use **AWS or other platforms** if they provide clear, high-value benefits (e.g. specialized databases, analytics, ML, long-running jobs), but:
  - They MUST be designed as separate services with explicit HTTP or queue-based APIs.
  - They MUST come with an incremental migration plan so the existing Cloudflare path continues to work until an explicit cutover.

## 2. Critical Workflows & Commands

- All development and CI flows should center on `dev-shell.sh` (sourced from the repo root).
- Key commands (run via `source dev-shell.sh`):
  - `ups_dev` – local dev server
  - `ups_test` – unit/integration tests (Vitest + RTL)
  - `ups_e2e` – Playwright E2E tests
  - `ups_coverage` – coverage run
  - `ups_lint_fix` – lint and auto-fix where safe
  - `ups_build` – production build
  - `ups_deploy*` – deployment helpers (see `dev-shell.sh` and `DEPLOYMENT.md`)
- Prefer using these commands directly or via VS Code tasks rather than introducing new ad-hoc `npm` scripts.

### 2.1 VS Code integration

- VS Code `tasks.json` SHOULD wrap the dev shell commands listed above so they can be run consistently over Remote-SSH on AN3.
- New workflows SHOULD follow this pattern: define a function in `dev-shell.sh` → expose it via a VS Code task → document it briefly in the relevant doc (e.g. `TESTING.md`, `DEPLOYMENT.md`).
- Launch configurations and debugging flows SHOULD assume the dev shell as the entrypoint where feasible.

## 3. Project-Specific Conventions

- Documentation truth sources:
  - `IMPLEMENTATION_STATUS.md` – feature-level implementation and verification status.
  - `PRODUCTION_READY_STATUS.md` – production readiness overview.
  - `DEPLOYMENT_COMPLETE.md` – deployment status and notes.
  - `TESTING.md` – testing strategy and commands.
- Environment and secrets:
  - Follow existing `.env` usage and secrets handling documented in `docs/SECURITY.md` and related files.
  - Do NOT hard-code secrets; use appropriate environment variables or secret stores (Cloudflare, GitHub Actions, or external service secrets) as documented.
- Tailwind and theming:
  - Use Tailwind utility classes and existing patterns for layout and theming.
  - Keep dark mode and accessibility considerations consistent with current UX patterns.
- User identity and storage:
  - `localStorage.ups_tracker_user_id` is the canonical client-side user identifier; reuse it instead of introducing parallel mechanisms unless a design doc justifies the change.
- Cloud providers:
  - Current production runtime is **Cloudflare Pages + Workers** and related services (KV, D1, Durable Objects, Queues, R2 as needed).
  - New services on AWS or other platforms are allowed when they clearly improve reliability, capability, performance, or cost, but they MUST:
    - Be introduced as separate, well-bounded services.
    - Communicate via explicit APIs.
    - Preserve the existing Cloudflare-based user flow until migration is complete.

## 4. Testing & Quality Expectations

- Unit/integration tests:
  - Use **Vitest + React Testing Library** for components and logic under `src/`.
- End-to-end tests:
  - Use **Playwright** specs in `e2e/`.
  - E2E test runs SHOULD produce HTML and JSON reports; `playwright-report/results.json` is the canonical JSON artifact.
- CI:
  - GitHub Actions workflows (e.g. `test.yml`, `e2e-tests.yml`, `ci.yml`) orchestrate linting, tests, builds, and deployments.
  - Scripts under `scripts/` (for example `validate-e2e-results.js`) are used to enforce correct behavior (e.g. fail CI on zero-spec runs).

### 4.1 Test philosophy (honest tests, real behavior)

- Write tests that validate real behavior, not cosmetic assertions.
- Coverage improvements should come from testing meaningful paths, not trivial getters.
- When implementing fixes:
  - Add or update tests that would fail if the behavior regressed.
  - Run tests locally to confirm green before committing.
  - Prefer incremental, focused changes over large batches.
- If removing code, REMOVE or update the related tests instead of skipping or commenting them out.

### 4.2 Automations

- Prefer adding small shell/Node scripts under `scripts/` and wiring them into existing GitHub Actions rather than creating entirely new workflows.
- New CI behavior SHOULD:
  - Reuse existing jobs (lint, unit, E2E, deploy) where possible.
  - Avoid duplicating configuration already present in `test.yml`, `e2e-tests.yml`, or `ci.yml`.
- Any script or workflow intended for repeated use MUST be documented in `README.md` or `TESTING.md`.

## 5. File/Module-Level Guidance

- `src/PackageCarTracker.jsx` is the main coordinator component for the UI.
- API communication should go through shared API client modules (for example `src/api/*`) rather than ad-hoc `fetch` calls.
- WebSocket behavior should go through `WebSocketService` and its tests (`WebSocketService.test.jsx`) rather than scattered socket logic.
- Cloudflare Workers under `workers/` should:
  - Use centralized validators and auth helpers.
  - Keep request/response shapes consistent with the frontend API client.
- Storage-related code (D1, KV, local storage) should live in dedicated modules under `src/storage/` or `workers/` helpers as appropriate.

## 6. How to Work with This Repo as an AI Agent

When responding to requests, your goal is to produce **real fixes, upgrades, or refactors**, not cosmetic changes that only make dashboards look green.

- Do NOT:
  - Add no-op branches, dummy conditions, or meaningless assertions just to raise coverage.
  - Relax tests to accept incorrect behavior merely to avoid a failure.
  - Skip, comment out, or neuter tests without a justified behavioral change.
- DO:
  - Fix underlying causes of failures or coverage gaps, or explicitly document why a failure is acceptable and adjust expectations accordingly.
  - Prefer small, behavior-accurate improvements over large, cosmetic rewrites.
  - Keep tests, docs, and implementation honest to what actually happens in production.

- Always read this canonical instructions file before proposing changes.
- Prefer **incremental, reversible edits** by default:
  - Small, well-scoped changes with corresponding tests.
  - Avoid large, cross-cutting refactors unless explicitly requested or clearly justified by the Upgrade Philosophy.
- Use `dev-shell.sh` commands instead of inventing new `npm`/`wrangler` flows.
- When tests or builds fail:
  - Report the actual error output.
  - Propose concrete, minimal fixes.
  - Do NOT claim success without real evidence from test/build output.
- For high-value upgrades or multi-service designs:
  - Propose options (Cloudflare-native vs additional services like AWS).
  - Outline pros/cons and a staged migration.
  - Wait for explicit approval before making cross-cutting or multi-service changes.

## 7. Remote & Mobile Workflows (AN3 + iPhone)

- The primary machine is AN3, accessed via Remote-SSH, Tailscale, and mobile tools (Termius, Secure ShellFish, Textastic, Servercat, RDP clients).
- All critical workflows MUST be runnable from a plain terminal over SSH:
  - `dev-shell.sh` + `ups_*` commands are the primary interface.
  - Scripts under `scripts/` should be self-contained and avoid GUI dependencies.
- Logging and diagnostics SHOULD be CLI-friendly:
  - Use `console.log` and `wrangler tail` style tooling rather than GUI-only debuggers.
- New automation scripts should:
  - Live under `scripts/`.
  - Have simple, documented one-liner usage suitable for SSH sessions and mobile keyboards.
# GitHub Copilot Instructions for `ups-tracker`

These instructions guide AI coding agents working in this repo. Follow them **strictly** unless the user overrides.

By default, agents SHOULD **take actions directly** (including running dev-shell commands, VS Code tasks, and non-destructive scripts) instead of asking for permission. Only pause to confirm when a change is clearly destructive (e.g., data wipes, production deploys), or when selecting between materially different architectural or product directions.

## Upgrade Philosophy

This project is **production-ready** and must remain stable for current users. However, as the sole maintainer, the owner is open to **high-value upgrades and major refactors** when they deliver clear benefits.

When proposing significant changes:

- **Justify with clarity:** Articulate concrete benefits (performance, reliability, cost, capability, maintainability) and trade-offs.
- **Stage migrations:** Provide an incremental rollout plan that preserves production stability. No "big bang" cutovers.
- **Update tests and docs:** Changes must include corresponding test updates (no zombie tests) and documentation updates in the same commit/PR.
- **Consider multiple providers:** Current runtime is Cloudflare Pages + Workers. Prefer reusing existing infrastructure when sufficient, but do **not** be constrained by vendor loyalty.
  - New services MAY use AWS, GCP, or other platforms if they provide clear value over Cloudflare-native options.
  - Design cross-platform integrations as separate services with explicit HTTP APIs, message queues, or other clean boundaries.
  - Always propose at least two options: a Cloudflare-native path and an alternative platform approach, with pros/cons for each.
- **Design documentation:** For large changes (new services, major refactors, protocol changes), add a short design note—even just a Markdown section in `docs/`—outlining the approach, alternatives considered, and migration steps.

**Default bias:** Incremental, reversible, well-tested changes. But when a major upgrade is clearly superior, propose it boldly with the structure above.

## 0. Editor & Extensions (AN3 baseline)

Primary editor: VS Code on AN3.

Recommended extensions (assume they are available):

- Tailwind CSS IntelliSense
- ESLint + Prettier
- GitHub Copilot & GitHub Copilot Chat
- GitLens
- Playwright Test for VS Code
- Cloudflare Workers (for Wrangler integration)
- Markdown All in One

Agents SHOULD:
- Reuse existing ESLint/Prettier config instead of adding new formatters.
- Prefer Tailwind utility classes + existing CSS files over new ad-hoc stylesheets.
- Add VS Code tasks instead of new ad-hoc npm scripts when possible (see dev shell).

## 1. Big-Picture Architecture

- **Frontend:** React + Vite + TailwindCSS v4 in `src/`.
  - Entry: `src/main.jsx`, root app in `src/App.jsx`, main tracker UI in `src/PackageCarTracker.jsx`.
  - UI components live under `src/components/` (e.g. `Header`, `DiagnosticsDrawer`, `NotificationSettings`).
  - Styling: Tailwind with `darkMode: 'class'`; global styles in `src/index.css` and `src/App.css`.
- **Backend:** Cloudflare Workers in `workers/`.
  - API worker: `workers/api.js` (D1, KV, rate limiting, validation via `workers/validators.js`).
  - Auth/rate limiting: `workers/auth.js` using Cloudflare KV + secrets.
  - Worker config: `workers/wrangler.toml` and root `wrangler.toml`.
- **Data Model & Storage:**
  - Client-side model: `src/model/packageCarSchema.js` defines the car schema and validation.
  - Persistent storage: `src/storage/trackerStorage.js` (versioned localStorage / IndexedDB-style wrapper).
  - Usage tracking: `src/usage/usageCounters.js` and related tests.
- **API layer:**
  - HTTP client: `src/api/apiClient.js` (cars, shifts, sessions, usage, etc.).
  - WebSocket client: `src/services/WebSocketService.js` with tests in `src/WebSocketService.test.jsx`.
- **Tests:**
  - Unit/integration: Vitest + RTL under `src/**/*.test.jsx`.
  - E2E: Playwright under `e2e/` with config in `playwright.config.js`.
  - Testing guide: `TESTING.md` is the canonical reference.

When changing behavior, **update both the React component and corresponding model/API layer** and validate via existing tests.

## 2. Critical Workflows & Commands

Prefer using the **dev shell** (`source dev-shell.sh`) instead of raw npm commands:

- Development:
  - `ups_dev` → `npm run dev` (Vite dev server).
  - `ups_test [args]` → `npm test -- --run` (Vitest).
  - `ups_e2e [args]` → `npx playwright test` against the configured `BASE_URL`.
  - `ups_coverage` → `npm test -- --coverage`.
  - `ups_lint_fix` → `npm run lint -- --fix`.
- Build & Deploy:
  - `ups_build` → `npm run build`.
  - `ups_deploy` / `ups_deploy_dirty` → preview deploys via `npm run deploy` / `npm run deploy:dirty`.
  - `ups_deploy_prod` → runs release flow then deploys to Cloudflare Pages production.
- E2E in CI:
  - Workflow: `.github/workflows/e2e-tests.yml`.
  - Uses `BASE_URL=https://main.ups-tracker.pages.dev` and `playwright.config.js` reporters (HTML + JSON).
  - **Validation:** `scripts/validate-e2e-results.js` fails the run if Playwright only listed tests (0 specs).

When writing instructions or scripts, **align with these commands** instead of inventing new entrypoints.

### 2.1 VS Code integration

- VS Code `tasks.json` SHOULD wrap the dev shell commands (`ups_dev`, `ups_test`, `ups_e2e`, `ups_coverage`, `ups_lint_fix`).
- When adding new workflows, prefer:
  - `dev-shell.sh` function → VS Code task → referenced from docs,
  - NOT raw `npm` commands scattered across README, docs, and CI.
- Launch configs SHOULD assume the dev shell as the entrypoint where possible.

## 3. Project-Specific Conventions

- **Docs truth sources:**
  - Current implementation status: `IMPLEMENTATION_STATUS.md`.
  - Production readiness: `PRODUCTION_READY_STATUS.md` and `DEPLOYMENT_COMPLETE.md`.
  - Testing details: `TESTING.md` and `E2E_TEST_IMPLEMENTATION_PLAN.md`.
  - Security: `P0_SECURITY_COMPLETE.md` + `docs/SECURITY.md` + `SECURITY_QUICKREF.md`.
  - Many older docs live under `docs/archive/` and are **historical only**; do not treat them as current truth.
- **Env & secrets:**
  - Frontend env: `.env` derived from `.env.example` (`VITE_API_URL`, `VITE_API_KEY`, `VITE_ENABLE_SYNC`, etc.).
  - Worker secrets: configured via Wrangler as documented in `docs/SECURITY.md` and `P0_SECURITY_COMPLETE.md`.
  - Do **not** hard-code secrets; rely on existing env patterns and `wrangler.toml` bindings.
- **Tailwind/dark mode:** use class-based dark mode (`dark` class on root), not system preference.
- **User ID:** stored in `localStorage.ups_tracker_user_id`; tests and E2E assume it is set (often `'e2e-test-user'` or `'anonymous'`).

When updating behavior, cross-check these docs instead of assuming generic practices.

### 3.1 Infrastructure & Platform Strategy

- **Current runtime:** Cloudflare Pages + Workers (KV, D1, Durable Objects).
- **Platform philosophy:**
  - Prefer reusing existing Cloudflare infrastructure when it is sufficient for the task.
  - New services MAY use AWS or other platforms if they provide clear value over Cloudflare-native solutions (e.g., richer managed database, advanced queuing, specialized analytics, ML services).
  - When proposing cross-platform integrations:
    - Design them as **separate services** with explicit APIs (HTTP, WebSocket, message queues).
    - Provide a **staged migration plan** so existing production paths continue working during rollout.
    - Outline pros/cons: cost, complexity, performance, vendor lock-in, operational burden.
  - For major architectural decisions (e.g., "add AWS RDS + Lambda for analytics"), propose at least two options with trade-off analysis before implementing.

Agents SHOULD NOT silently replace Cloudflare components with AWS equivalents. Instead, propose additions or migrations with clear justification and incremental steps.

## 4. Testing & Quality Expectations

- **Unit tests:** For changes in `src/`, add/adjust Vitest tests colocated with the code (`*.test.jsx` or `*.test.js`). Follow existing patterns in:
  - `src/PackageCarTracker.test.jsx`
  - `src/storage/trackerStorage.test.jsx`
  - `src/model/packageCarSchema.test.jsx`
- **E2E tests:**
  - Specs in `e2e/*.spec.js` are the source of truth for user journeys (car management, shift tracking, CSV import/export, accessibility).
  - Update selectors and flows in both React components and E2E specs to stay in sync (e.g. `data-testid="car-card-${car.id}"`).
- **CI:**
  - Do not bypass tests or linting in workflows; changes must keep `test.yml`, `e2e-tests.yml`, and `ci.yml` green.
  - If you add new scripts, wire them into existing workflows instead of creating parallel ones.

Before declaring a fix "done", ensure relevant unit tests and at least the targeted E2E spec pass locally.

### 4.1 Test philosophy (no zombies, no fakery)

- Do NOT add placeholder tests that assert trivially true conditions just to satisfy coverage.
- Each new behavior MUST be covered by at least one meaningful test that would fail if the behavior regressed.
- When changing behavior:
  - Prefer red → green flow: adjust or add a failing test first, then fix the implementation.
- If removing code, REMOVE or update the related tests instead of skipping or commenting them out.

### 4.2 Automations

- Prefer adding small shell/Node scripts under `scripts/` and wiring them into existing GitHub Actions rather than creating entirely new workflows.
- New CI behavior SHOULD:
  - Reuse existing jobs (lint, unit, E2E, deploy) where possible.
  - Avoid duplicating configuration already present in `test.yml`, `e2e-tests.yml`, or `ci.yml`.
- Any script or workflow intended for repeated use MUST be documented in `README.md` or `TESTING.md`.

## 5. File/Module-Level Guidance

- `src/PackageCarTracker.jsx`:
  - Central orchestrator for cars, shifts, sessions, usage, and WebSocket sync.
  - Keep it as a coordinator: heavy logic should live in `model/`, `services/`, or `storage/` modules.
- `src/api/apiClient.js`:
  - Single source of truth for backend HTTP calls; do not scatter `fetch`/`axios` usage elsewhere.
  - When adding endpoints, also update MSW handlers in `src/mocks/handlers.js`.
- `src/services/WebSocketService.js`:
  - Encapsulates WebSocket logic; callers should not manage raw `WebSocket` lifecycle.
  - Use existing event names/payload shapes; update tests when protocol changes.
- `workers/api.js` / `workers/auth.js` / `workers/validators.js`:
  - Keep validation and auth at the edge; do not duplicate rules in the frontend beyond basic UX checks.

## 6. How to Work with This Repo as an AI Agent

- Always:
  - Check `IMPLEMENTATION_STATUS.md` before making "status" claims.
  - Use `README.md` and `TESTING.md` for commands instead of guessing.
  - Respect the dev shell (`dev-shell.sh`) as the primary interface for developers.
- Avoid:
  - Adding new top-level scripts or workflows without integrating with existing ones.
  - Introducing new documentation files for concepts already covered (update existing docs instead).
  - Making breaking changes to E2E selectors or flows without updating `e2e/*.spec.js` accordingly.

When in doubt, prefer small, well-tested changes that align with existing patterns over large refactors or new systems—**unless** a large refactor is clearly justified and staged properly per the Upgrade Philosophy above.

## 7. Remote & Mobile Workflows (AN3 + iPhone)

The primary dev machine is AN3, but development and checks may be run remotely via:

- Tailscale + Termius / Secure ShellFish (SSH into AN3)
- RDP client on iPhone
- GitHub web / Codespaces (occasionally)
- Textastic / Servercat for quick file edits and command runs

Given this, agents SHOULD:

- Prefer CLI-friendly flows:
  - All critical commands MUST be runnable from a plain terminal (no GUI-only steps).
  - Scripts in `scripts/` SHOULD be self-contained and not rely on VS Code UI.
- Keep logs and diagnostics accessible:
  - Use `console.log` / structured logs and `wrangler tail` (or similar) for Workers.
  - Avoid solutions that require local GUIs to debug (e.g., inspector-only).
- When adding new scripts:
  - Place them under `scripts/` and document one-liner usage so they can be launched from Termius/SSH easily.
