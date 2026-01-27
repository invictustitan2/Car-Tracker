# UPS Package Car Tracker

**🚀 PRODUCTION: [https://main.ups-tracker.pages.dev](https://main.ups-tracker.pages.dev)**  
**📊 API: [https://ups-tracker-api.invictustitan2.workers.dev](https://ups-tracker-api.invictustitan2.workers.dev)**

Real-time, multi-user warehouse dashboard for tracking UPS package cars during shifts. Built with React + Vite, Tailwind CSS v4, Cloudflare Workers + D1, deployed to Cloudflare Pages.

## Developer workflow & Copilot

This repo is designed to be developed primarily from **VS Code on AN3** (Remote-SSH, iPhone SSH/RDP friendly).

If you’re working in this repo (including AI agents), start here:

- Canonical instructions: `.github/instructions/ups-tracker.instructions.md`
- Dev env + Copilot workflow: `docs/DEV_ENV_COPILOT.md`
- Everyday prompt files (for GitHub Copilot Chat):
   - `/ups-dev-cycle` – main feature/bugfix loop
   - `/ups-e2e-doctor` – Playwright failures
   - `/ups-cf-and-services-arch` – architecture & services planning
   - `/ups-docs-tests-sync` – keep code/tests/docs aligned
   - `/ups-quick-edit` – small local refactors

These docs encode the **Upgrade Philosophy**: incremental changes by default, but bold, well-planned upgrades when they provide clear value.

## 🎉 Production Status (November 23, 2025)

**✅ DEPLOYED AND OPERATIONAL**

- **Security:** All P0 issues resolved (API auth, CORS, rate limiting, input validation)
- **Infrastructure:** Cloudflare Worker + Pages + D1 + KV + Durable Objects
- **Production Readiness:** 95%
- **Test Coverage:** 96% (178/186 tests passing)
- **Next Step:** Manual floor testing on devices

See [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md) for full deployment details.

## ✨ What's New - WebSocket Real-Time + Push Notifications!

**The tracker now features instant real-time updates and push notifications!**

- ⚡ **WebSocket real-time** - Changes broadcast instantly to all devices (<100ms latency)
- 🔔 **Push notifications** - Get alerts even when app is closed (PWA feature)
- 🔄 **Durable Objects** - Scalable WebSocket connection management via Cloudflare
- 📱 **Progressive Web App** - Install on mobile devices, works offline
- 👥 **Live user count** - See how many team members are online
- 🔐 **Service Worker** - Offline caching and background notifications
- 📊 **Audit log viewer** - View complete history of changes for any car
- 🎯 **Shift tracking** - Start/end shifts with automatic snapshots

### Quick Test (Try it now!)
1. Open https://tracker.aperion.cc in two browser tabs
2. Mark a car as arrived in one tab
3. **Watch it update INSTANTLY in the other tab!** (no 5-second delay)
4. Click "Notifications" button → Enable push notifications
5. Close the app and get real-time alerts on car changes!

**Note:** See [WEBSOCKET_PUSH_IMPLEMENTATION.md](WEBSOCKET_PUSH_IMPLEMENTATION.md) for technical details. See [FEATURE_AUDIT.md](FEATURE_AUDIT.md) for complete feature status.

## Key Features

- **Enhanced filters & board view** – search, status, and location filters compose cleanly with memoized cards to keep interactions snappy.
- **Snap-to-start columns** – board view uses horizontal scroll snap with sticky headers so TC57 handhelds can flick between zones without losing context.
- **CSV import/export** – fleet managers can bulk load car IDs or export the current roster (ID, location, arrived, empty, late) for roster maintenance.
- **Versioned localStorage** – persisted data stores a schema version plus lightweight usage counters so future migrations keep historical data intact.
- **Usage diagnostics** – filter clicks, location taps, and view toggles increment local counters (not surfaced in the UI) for quick field audits.

## Environment Setup

- Node.js **20.19.5** is pinned in `.nvmrc`; `npm install` enforces `>=20.19.0` via the `engines` field and a `preinstall` guard.
- To auto-load the helper shell without upsetting login shells, add the following snippet to `~/.bashrc` (or equivalent):

```bash
if [ -f "/home/dreamboat/projects/ups-tracker/dev-shell.sh" ]; then
	set +u
	source "/home/dreamboat/projects/ups-tracker/dev-shell.sh"
	set -u
fi
```
- Cloudflare Pages deployments must also run on Node **20.19.5+**; set the build image or `nvm use` in CI before invoking `wrangler pages deploy`.

## Development Workflow

- After each change run `npm test` followed by `npm run build` (or use `ups_test` / `ups_build` inside `dev-shell.sh`).
- Deploy a preview with `npm run deploy` when the tree is clean, or `npm run deploy:dirty` if intentionally shipping local changes.
- Record every meaningful step with `node scripts/note-change.js "what changed"`; `TODO.md` is the single source of truth for process notes.
- Share patches by running `bash scripts/make-patch.sh` and uploading `/tmp/ups-tracker.patch` along with the preview link.
- Package a release-ready zip via `bash scripts/make-release-zip.sh`; it runs `npm run build` and archives the repo (sans `.git`, `node_modules`, logs) to `/tmp/ups-tracker-release-<timestamp>.zip`.

## Testing

The application includes comprehensive testing at multiple levels:

### Unit Tests (Vitest + React Testing Library)

```bash
# Run in watch mode
npm test

# Run once
npm run test:unit

# With coverage
npm run test:coverage
```

### End-to-End Tests (Playwright)

```bash
# Run E2E tests (headless)
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Watch browser (headed mode)
npm run test:e2e:headed
```

### Run All Tests

```bash
npm run test:all
```

**Testing Features:**
- ✅ Unit tests with Vitest and React Testing Library
- ✅ E2E browser automation with Playwright
- ✅ API mocking with Mock Service Worker (MSW 2.0)
- ✅ WebSocket testing with mock-socket
- ✅ Accessibility testing with axe-core (WCAG 2.1 AA)
- ✅ Code coverage reporting (70% thresholds)
- ✅ CI/CD integration with GitHub Actions

See [TESTING.md](TESTING.md) for detailed testing documentation.

## How to Release and Deploy

### Local Release Process

We use `dev-shell.sh` helpers to ensure quality gates (lint, test, build) are passed before deployment.

1. **Create a Release Artifact** (optional for manual releases):
   ```bash
   ups_release
   ```
   This runs:
   - `npm run lint` - ESLint checks
   - `npm test -- --run` - Full test suite
   - `npm run build` - Production Vite build
   - Creates `/tmp/ups-tracker-release-<timestamp>-<sha>.zip`

2. **Deploy to Production**:
   ```bash
   ups_deploy_prod
   ```
   This automatically runs `ups_release` first, then deploys `dist/` to Cloudflare Pages production branch.

### GitHub Release Process (Recommended)

For tagged releases with automated artifact generation:

1. Ensure all changes are committed and pushed to `main`
2. Create and push a version tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. GitHub Actions will automatically:
   - Run all quality gates (lint, test, build)
   - Create release archive
   - Generate GitHub Release with changelog
   - Attach downloadable zip artifact

### One-Time Cloudflare Pages Setup

#### Connect GitHub Repository

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Authorize Cloudflare to access your GitHub account
4. Select the `ups-tracker` repository
5. Click **Begin setup**

#### Configure Build Settings

On the setup page, configure:

- **Project name**: `ups-tracker` (must match `wrangler.toml`)
- **Production branch**: `main`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave as default)

**Environment Variables** (click "Add variable"):
- `NODE_VERSION`: `20.19.5`
- `VITE_API_URL`: `https://ups-tracker-api.invictustitan2.workers.dev`
- `VITE_ENABLE_SYNC`: `true`
- `VITE_USER_ID`: `warehouse-1` (or device-specific identifier)
- `VITE_VAPID_PUBLIC_KEY`: Your VAPID public key (see Push Notifications setup below)

Click **Save and Deploy**. First build will take 2-3 minutes.

### Push Notifications Setup

Push notifications require VAPID (Voluntary Application Server Identification) keys:

1. **Generate VAPID keys** (one-time):
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Add to GitHub Secrets** (for Cloudflare Pages deployment):
   - Go to: https://github.com/invictustitan2/ups-tracker/settings/secrets/actions
   - Click "New repository secret"
   - Add secret:
     - **Name**: `VITE_VAPID_PUBLIC_KEY`
     - **Value**: Your VAPID public key from step 1

3. **Add to local `.env`** (for development):
   ```bash
   # Copy from .env.example
   cp .env.example .env
   
   # Add your VAPID public key
   echo "VITE_VAPID_PUBLIC_KEY=your_public_key_here" >> .env
   ```

4. **Store VAPID private key securely**:
   - **DO NOT commit to git**
   - Store in password manager or secure vault
   - Only needed if implementing server-side push sending (future feature)

5. **Test notifications**:
   - Run `npm run dev` locally
   - Click "Notifications" button in sidebar
   - Click "Enable Notifications"
   - Allow browser permission
   - Click "Send Test" to verify it works

**Note**: Push notifications work on:
- ✅ Chrome/Edge (desktop & Android)
- ✅ Firefox (desktop & Android)
- ⚠️ Safari (desktop only, iOS has limitations)

#### Configure Custom Domain (tracker.aperion.cc)

1. After first deployment completes, go to your Cloudflare Pages project
2. Click **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter: `tracker.aperion.cc`
5. Click **Continue**

Cloudflare will provide DNS configuration:

6. Go to **DNS** → **Records** (in main Cloudflare dashboard)
7. Add a **CNAME record**:
   - **Type**: `CNAME`
   - **Name**: `tracker` (subdomain)
   - **Target**: `ups-tracker.pages.dev` (your Pages URL)
   - **Proxy status**: ✅ Proxied (orange cloud - enables Cloudflare security & CDN)
   - **TTL**: Auto
8. Click **Save**

**SSL/HTTPS**: Cloudflare automatically provisions a free SSL certificate for `tracker.aperion.cc`. This takes 1-2 minutes. Once the certificate status shows "Active", your site will be live at:
- 🔒 `https://tracker.aperion.cc` (custom domain)
- 🔒 `https://ups-tracker.pages.dev` (Cloudflare Pages URL)

**Verification**:
- Visit `https://tracker.aperion.cc` in a browser
- Confirm the SSL padlock appears (HTTPS is working)
- Test the app loads and localStorage persists across refreshes

### Continuous Integration

GitHub Actions automatically run quality gates on:

- **Every push to `main`**: Runs lint → test → build → deploy to tracker.aperion.cc
- **Every pull request**: Runs lint → test → build (no deployment)
- **Tagged releases** (`v*`): Runs checks + creates release artifacts

View workflow runs at: `https://github.com/invictustitan2/ups-tracker/actions`

**Required GitHub Secrets** (for auto-deployment):
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages/Workers edit permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

Run `bash scripts/setup-github-secrets.sh` for setup instructions.

### Deployment Workflow

**Automatic** (via GitHub Actions):
- Push to `main` → GitHub Actions runs quality gates → Auto-deploys to tracker.aperion.cc
- Deployment uses environment variables from workflow (VITE_API_URL, etc.)
- Check deployment status in Actions tab

**Manual** (via Wrangler CLI):
- `ups_deploy_prod` - Deploys to production branch after quality gates
- `npm run deploy` - Quick deploy (dirty tree allowed) for testing

**Preview Deployments**:
Every git branch gets a unique preview URL:
```
https://<BRANCH-NAME>.ups-tracker.pages.dev
```

### Rollback Procedure

If a deployment causes issues:

1. Go to Cloudflare Pages project → **Deployments** tab
2. Find the last working deployment
3. Click **⋮** → **Rollback to this deployment**
4. Confirm rollback

Or via Git:
```bash
git revert <problematic-commit-sha>
git push origin main
```

Cloudflare will auto-deploy the reverted state.

