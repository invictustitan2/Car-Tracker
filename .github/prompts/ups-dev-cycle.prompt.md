---
name: UPS Tracker Development Cycle
description: Main development workflow agent for ups-tracker repo
author: ups-tracker maintainer
tags: [development, workflow, testing]
---

# UPS Tracker Development Cycle


requires:
   - .github/instructions/ups-tracker.instructions.md
---

> **Repository context:**  
> Before acting, read `.github/instructions/ups-tracker.instructions.md`, especially the **“Upgrade Philosophy”** section.  
> - Default to incremental, reversible changes.  
> - When a high-value upgrade or major refactor is identified, propose it explicitly with benefits, trade-offs, and a staged migration plan.  
> - For large upgrades, always propose both:  
>   - a “minimal change” path that keeps the current architecture, and  
>   - one or more “bigger upgrade” paths (Cloudflare-only vs multi-service/AWS, etc.) with pros/cons.  
> - For normal development work (features, bugfixes, test updates, docs), **act directly**: run commands, edit files, and apply patches without asking for permission.

You are GitHub Copilot Chat working in the `ups-tracker` repository on the AN3 machine.

Before you do anything, **read** `.github/instructions/ups-tracker.instructions.md` and follow its Upgrade Philosophy, dev shell usage, testing expectations, and remote workflow constraints.

Assume you should **execute the development workflow end-to-end** (including running `ups_*` commands and VS Code tasks) without asking, unless a step would:
- wipe or irreversibly modify real data,
- deploy to production, or
- choose between competing architectural or product directions.

## Setup

Before starting any work:

1. **Read the canonical instructions:** `.github/instructions/ups-tracker.instructions.md`
2. **Check current status:** Review `IMPLEMENTATION_STATUS.md`, `PRODUCTION_READY_STATUS.md`, and `TESTING.md`
3. **Source the dev shell:** All commands use `dev-shell.sh` functions

## Workflow

When given a feature request or bug report:

### 1. Identify Relevant Files

Map the request to the architecture:
- **Frontend components:** `src/components/`, `src/PackageCarTracker.jsx`
- **Data model & validation:** `src/model/packageCarSchema.js`
- **Storage layer:** `src/storage/trackerStorage.js`
- **API client:** `src/api/apiClient.js`
- **Workers backend:** `workers/api.js`, `workers/auth.js`, `workers/validators.js`
- **WebSocket:** `src/services/WebSocketService.js`

### 2. Propose Small, Reviewable Changes

- Make **minimal edits** that address the specific request
- Prefer refining existing code over adding new files
- Show a summary of planned changes before applying
- Include corresponding test updates (no zombie tests!)
- Never introduce changes whose only purpose is to “make CI green” (for example, weakening assertions, adding no-op branches, or trivial tests that don’t reflect real behavior).

### 3. Update Tests

For any behavior change:
- **Unit tests:** Add/update Vitest tests colocated with the code (`*.test.jsx`)
- **E2E tests:** Update `e2e/*.spec.js` if user-facing flows change
- **Selectors:** Keep `data-testid` attributes in sync between components and E2E specs

Follow the "no zombies" philosophy: every test must meaningfully verify behavior.

### 4. Run Dev Shell Commands

Execute appropriate validation:
```bash
source dev-shell.sh
ups_test              # Run Vitest unit tests
ups_e2e               # Run Playwright E2E tests
ups_coverage          # Check coverage
ups_lint_fix          # Auto-fix linting issues
```

Interpret results and fix any failures before declaring the work complete.

### 5. Update Documentation

If behavior changes affect:
- **API contracts:** Update `workers/api.js` comments and `docs/`
- **User workflows:** Update `README.md` or create entries in `CHANGELOG.md`
- **Status tracking:** Update `IMPLEMENTATION_STATUS.md`, `PRODUCTION_READY_STATUS.md`
- **Security:** Update `P0_SECURITY_COMPLETE.md` or `docs/SECURITY.md` if relevant

### 6. High-Value Upgrades & Refactors

If you identify an opportunity for a **major improvement** (not just a local fix):

**Do NOT apply it silently.** Instead:

1. **Draft a design section** summarizing:
   - Current approach and its limitations
   - Option A: Cloudflare-native upgrade (e.g., use Durable Objects, Queues, D1 enhancements)
   - Option B: Cross-platform service (e.g., AWS Lambda + SQS, RDS, ElastiCache)
   - Option C: Keep as-is with incremental fixes
2. **Outline pros/cons** for each:
   - Cost (compute, storage, data transfer)
   - Complexity (new deployment paths, dependencies, monitoring)
   - Performance (latency, throughput, scalability)
   - Lock-in (vendor dependency, portability)
3. **Provide a staged migration plan:**
   - Phase 1: Deploy new service alongside existing paths
   - Phase 2: Gradual rollout with feature flags
   - Phase 3: Full cutover and deprecation of old path
4. **Wait for explicit approval** before implementing large changes

The upgrade philosophy encourages **bold, high-value proposals** when justified—but they must be staged and well-documented.

## Remote & Mobile Context

All workflows must work over SSH on AN3 and from iPhone (Termius, Secure ShellFish, Textastic):
- Use CLI commands from `dev-shell.sh`, not GUI-only tools
- Logs and errors should be terminal-friendly
- Scripts should be runnable from `bash -lc "source dev-shell.sh && ups_test"`

## Anti-Patterns to Avoid

- ❌ Adding tests that always pass (zombie tests)
- ❌ Scattering raw `npm` or `wrangler` commands instead of using dev shell
- ❌ Making large refactors without design notes and staging
- ❌ Silently introducing AWS services without justification and migration plan
- ❌ Changing E2E selectors without updating `e2e/*.spec.js`
- ❌ Creating new doc files for topics already covered in existing docs

## Success Criteria

A change is "done" when:
1. ✅ Relevant unit tests pass (`ups_test`)
2. ✅ Targeted E2E specs pass (`ups_e2e`)
3. ✅ Linting is clean (`ups_lint_fix`)
4. ✅ Docs and status files are updated
5. ✅ The change is small, reviewable, and reversible—OR has a staged migration plan if large
