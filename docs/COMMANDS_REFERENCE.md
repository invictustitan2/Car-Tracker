# UPS Tracker – Commands Reference

This is the **canonical commands cheat sheet** for the `ups-tracker` project.

It’s designed for:
- VS Code on **AN3** (Remote-SSH, RDP),
- iPhone (Termius / Secure ShellFish / Textastic),
- And any AI agents working in this repo.

For how Copilot and agents should behave, see:
- `.github/instructions/ups-tracker.instructions.md`
- `docs/DEV_ENV_COPILOT.md`

---

## 0. TL;DR – Most common commands

**Everyday loop (human + Copilot):**

```bash
# 0) Load dev shell (once per terminal)
cd /home/dreamboat/projects/ups-tracker
source dev-shell.sh

# 1) Start dev server
ups_dev

# 2) Run unit tests
ups_test

# 3) Run E2E tests
ups_e2e

# 4) Fix lint issues
ups_lint_fix

# 5) Build + preview locally
ups_build
npm run preview:local

# 6) See all dev shell commands
ups_help
```

Copilot Chat quick commands (from VS Code):

- `/ups-dev-cycle` – feature/bugfix loop (code + tests + docs).
- `/ups-e2e-doctor` – debug Playwright failures.
- `/ups-cf-and-services-arch` – architecture / Cloudflare / AWS planning.
- `/ups-docs-tests-sync` – keep code/tests/docs aligned.
- `/ups-quick-edit` – small local refactors.

---

## 1. Dev Shell Commands (`dev-shell.sh`)

Load the dev shell once in a terminal:

```bash
cd /home/dreamboat/projects/ups-tracker
source dev-shell.sh
```

Then you can use:

### 1.1 Core development

- `ups_status`  
  Show project status summary.

- `ups_cd_root`  
  Jump to the repo root.

- `ups_install`  
  Install dependencies (`npm install`) using the correct Node version.

- `ups_dev`  
  Start the Vite dev server.

- `ups_test`  
  Run the main Vitest test suite.

- `ups_test_fix`  
  Focused test run / fix-failing-tests helper (see `dev-shell.sh`).

- `ups_coverage`  
  Run tests with coverage.

- `ups_e2e`  
  Run Playwright E2E tests.

- `ups_e2e_ui`  
  Run Playwright E2E tests in UI mode.

- `ups_lint_fix`  
  Run ESLint with `--fix` using project config.

### 1.2 Build, preview, deploy

- `ups_build`  
  Build the app for production.

- `ups_preview`  
  Build + preview the app locally.

- `ups_deploy`  
  Deploy to Cloudflare Pages (clean working tree).

- `ups_deploy_dirty`  
  Deploy to Cloudflare Pages even with a dirty working tree.

- `ups_deploy_prod`  
  Production release flow (tests/build + deploy); see `dev-shell.sh` for details.

- `ups_release`  
  Run the release helper (often wraps `scripts/make-release-zip.sh` and validation).

### 1.3 Maintenance & docs

- `ups_clean`  
  Cleanup helper (remove build artifacts / reset state).

- `ups_audit`  
  Consolidated diagnostics (tests/lint/health) if implemented.

- `ups_docs_consolidate`  
  Apply the doc cohesion policy (archive older docs, avoid sprawl).

- `ups_doc_policy`  
  Print the current doc policy (`UPS_TRACKER_DOC_POLICY`).

- `ups_patch`  
  Build a patch file (wraps `scripts/make-patch.sh`).

- `ups_todo`  
  Show TODOs (from `TODO.md` or similar).

- `ups_help`  
  Show dev shell help (all commands with one-line descriptions).

> 🧠 **Tip:** On your phone in Termius/SSH, `source dev-shell.sh` + `ups_help` is the quickest way to see what’s available.

---

## 2. npm Scripts (`package.json`)

You can call these directly, but the dev shell usually wraps them.

### 2.1 Core dev

- `npm run dev` – Start Vite dev server.
- `npm run dev:worker` – Run Cloudflare Worker locally with Wrangler.
- `npm run lint` – Run ESLint.
- `npm run build` – Build for production.
- `npm run preview` – Preview the built app.

### 2.2 Tests

- `npm test` – Run Vitest in default mode.
- `npm run test:unit` – Run unit tests once.
- `npm run test:coverage` – Unit tests with coverage.
- `npm run test:e2e` – Playwright E2E tests.
- `npm run test:e2e:ui` – Playwright E2E UI mode.
- `npm run test:e2e:headed` – Playwright headed mode.
- `npm run test:e2e:prod` – E2E against production.
- `npm run test:all` – Run unit + E2E suites.

### 2.3 Deploy & DB

- `npm run preview:local` – Build and run local preview server.
- `npm run deploy` – Deploy to Cloudflare Pages.
- `npm run deploy:dirty` – Deploy to Cloudflare Pages with dirty tree.
- `npm run deploy:worker` – Deploy Workers via Wrangler.
- `npm run setup:d1` – Run `scripts/setup-d1.sh`.
- `npm run db:query:dev` – Query dev D1.
- `npm run db:query:prod` – Query prod D1.
- `npm run db:migrate` – Apply D1 migrations.
- `npm run release` – Lint + tests + build; release prep.

---

## 3. Project Scripts (`scripts/`)

Run these via `bash` or `node` from the repo root.

- `scripts/make-release-zip.sh` – Build a release zip from current git state.
- `scripts/setup-d1.sh` – Guided setup for Cloudflare D1.
- `scripts/deploy-vapid-key.sh` – Deploy Web Push / VAPID keys.
- `scripts/validate-production.sh` – Production validation checks before/after deploy.
- `scripts/test-sync.sh` – Check sync behavior between frontend and backend.
- `scripts/floor-test-validation.sh` – Helpers for floor testing / real-world validation.
- `scripts/setup-security.sh` – Security hardening / key setup.
- `scripts/setup-github-secrets.sh` – Setup secrets for GitHub Actions.
- `scripts/make-patch.sh` – Generate a patch capturing current changes.
- `scripts/monitor-workflows.sh` – Monitor GitHub workflows from the CLI.
- `scripts/note-change.js` – Note/log a change (e.g. for changelog or docs).

> **Usage pattern:**
> 
> ```bash
> bash scripts/<name>.sh
> # or
> node scripts/note-change.js
> ```

---

## 4. VS Code Tasks (`.vscode/tasks.json`)

These give “one click” access to dev shell commands from VS Code (incl. Remote-SSH).

- **`ups: dev`** – `bash -lc "source ./dev-shell.sh && ups_dev"`
- **`ups: unit tests`** – `bash -lc "source ./dev-shell.sh && ups_test"`
- **`ups: e2e tests`** – `bash -lc "source ./dev-shell.sh && ups_e2e"`
- **`ups: coverage`** – `bash -lc "source ./dev-shell.sh && ups_coverage"`
- **`ups: lint+fix`** – `bash -lc "source ./dev-shell.sh && ups_lint_fix"`

Trigger via:

- VS Code “Run Task…” menu, or
- Command palette (`Ctrl+Shift+P` → “Run Task”).

---

## 5. Copilot Chat Prompt Files (`.github/prompts/`)

Named workflows for GitHub Copilot Chat in this repo:

- `ups-dev-cycle.prompt.md` → `/ups-dev-cycle`  
  Main dev agent: feature/bugfix loop using dev shell, tests, and docs.  
  Reads canonical instructions + **Upgrade Philosophy**; proposes small changes by default, and presents bigger options + migration when needed.

- `ups-e2e-doctor.prompt.md` → `/ups-e2e-doctor`  
  Playwright E2E troubleshooting; runs E2E, reads `playwright-report/results.json`, maps failures to components/selectors.

- `ups-cf-and-services-arch.prompt.md` → `/ups-cf-and-services-arch`  
  Architecture & services planning; proposes Cloudflare-native vs multi-service (e.g. AWS) options; stays in design+migration mode until you pick.

- `ups-docs-tests-sync.prompt.md` → `/ups-docs-tests-sync`  
  Code/tests/docs alignment across `IMPLEMENTATION_STATUS.md`, `PRODUCTION_READY_STATUS.md`, `DEPLOYMENT_COMPLETE.md`, `TESTING.md`, and security docs.

- `ups-quick-edit.prompt.md` → `/ups-quick-edit`  
  Local refactors on the current file/selection; small, reversible changes.

---

## 6. Human-friendly usage patterns

You don’t need to memorize all of this. Use these habits instead:

1. **On any machine / phone**

   ```bash
   cd /home/dreamboat/projects/ups-tracker
   source dev-shell.sh
   ups_help
   ```

   That gives you an in-terminal, always-accurate list of dev shell commands.

2. **In VS Code**

   - Open Copilot Chat and start with:
     - `/ups-dev-cycle`
     - `/ups-e2e-doctor`
     - `/ups-cf-and-services-arch`
   - Let the agent drive commands through dev shell and tasks; you just approve diffs.

3. **When planning big upgrades**

   - Use `/ups-cf-and-services-arch` and expect:
     - At least two options (Cloudflare-native vs additional service),
     - Pros/cons + migration,
     - No code changes until you choose.

If you add new commands, **update this file and `ups_help`** in the same change so everything stays in sync.
