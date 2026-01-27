# UPS Package Car Tracker - Deployment Guide

**Last Updated**: November 23, 2025  
**Production Readiness**: 89% (see RUTHLESS_AUDIT.md)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Frontend Deployment](#frontend-deployment)
4. [Backend Deployment](#backend-deployment)
5. [Database Setup](#database-setup)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Accounts & Tools
- **Cloudflare Account** (Workers, Pages, D1, Durable Objects enabled)
- **Node.js** v20.19.5+ and npm 10.8.2+
- **Wrangler CLI** v3.0.0+: `npm install -g wrangler`
- **Git** for version control
- **VAPID Keys** for push notifications (optional)

### Browser Requirements
- **Production**: Chrome 90+, Firefox 88+, Safari 14+
- **Optimal**: Chrome 100+, Edge 100+
- **Mobile**: iOS Safari 14.5+, Chrome Android 90+

---

## Environment Variables

### Frontend (.env for local dev)

Create `.env` in project root:

```bash
# CRITICAL - Enable backend sync (required for production)
VITE_ENABLE_SYNC=true

# CRITICAL - Backend API URL
VITE_API_URL=https://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev

# OPTIONAL - Push notifications (frontend)
VITE_VAPID_PUBLIC_KEY=BH_OHdQSjfu4_YOUR_PUBLIC_KEY_HERE

# DEPRECATED - Now uses localStorage for user ID
# VITE_USER_ID=anonymous
```

### Backend (wrangler.toml)

Already configured in `workers/wrangler.toml`:

```toml
name = "ups-tracker-api"
main = "api.js"
compatibility_date = "2024-11-01"

[[d1_databases]]
binding = "DB"
database_name = "ups-tracker-db"
database_id = "YOUR_D1_DATABASE_ID"  # Set via wrangler

[[durable_objects.bindings]]
name = "WEBSOCKET_STATE"
class_name = "WebSocketState"
script_name = "ups-tracker-api"

[vars]
ALLOWED_ORIGINS = "*"  # Change to your domain in production
```

### Environment Setup Checklist

- [ ] Create `.env` with `VITE_ENABLE_SYNC=true`
- [ ] Set `VITE_API_URL` to your Workers URL
- [ ] Generate VAPID keys if using push notifications
- [ ] Update `ALLOWED_ORIGINS` in wrangler.toml for production
- [ ] Create D1 database and update `database_id`

---

## Frontend Deployment

### Option 1: Cloudflare Pages (Recommended)

#### Initial Setup

```bash
# 1. Build production bundle
npm run build

# 2. Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name ups-tracker

# 3. Set production environment variables in Cloudflare Dashboard
# Navigate to: Pages > ups-tracker > Settings > Environment Variables
# Add:
#   VITE_ENABLE_SYNC=true
#   VITE_API_URL=https://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev
#   VITE_VAPID_PUBLIC_KEY=YOUR_KEY (optional)
```

#### Subsequent Deployments

```bash
# Using dev shell
source dev-shell.sh
ups_deploy_prod

# Or manually
npm run build
npx wrangler pages deploy dist --project-name ups-tracker --branch production
```

#### Production Branch Setup

```bash
# Deploy to production branch (auto-deploy on git push)
npx wrangler pages deploy dist --project-name ups-tracker --branch production --commit-dirty=true
```

### Option 2: Static Host (Vercel, Netlify, etc.)

```bash
# 1. Build
npm run build

# 2. Upload dist/ folder to your hosting provider

# 3. Configure environment variables in host dashboard:
#    VITE_ENABLE_SYNC=true
#    VITE_API_URL=https://your-worker-url.workers.dev
#    VITE_VAPID_PUBLIC_KEY=YOUR_KEY
```

### Build Configuration

**Vite Config** (`vite.config.js`):
- Output: `dist/` directory
- Base: `/` (root path)
- Assets: Hashed filenames for cache busting
- Service Worker: Included in build

**Important**: Service Worker requires HTTPS to function. Use Cloudflare Pages or similar for automatic HTTPS.

---

## Backend Deployment

### Initial Cloudflare Workers Setup

```bash
cd workers/

# 1. Authenticate with Cloudflare
wrangler login

# 2. Create D1 database
wrangler d1 create ups-tracker-db

# Copy the database_id from output and update workers/wrangler.toml:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 3. Run migrations
wrangler d1 migrations apply ups-tracker-db --local  # Test locally first
wrangler d1 migrations apply ups-tracker-db          # Apply to production

# 4. Deploy Worker
wrangler deploy

# Note the deployed URL: https://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev
```

### Database Migrations

Migrations are in `migrations/` folder:

1. **0001_initial_schema.sql**: Core tables (cars, shifts, sessions, usage, audit_logs)
2. **0002_push_subscriptions.sql**: Push notification subscriptions

```bash
# Apply migrations
cd workers/
wrangler d1 migrations apply ups-tracker-db

# Verify migration status
wrangler d1 migrations list ups-tracker-db
```

### Backend Update Deployment

```bash
cd workers/

# Deploy updated Worker
wrangler deploy

# Or use dev shell
source ../dev-shell.sh
ups_deploy
```

### Enable Durable Objects

Durable Objects are required for WebSocket state management.

```bash
# In Cloudflare Dashboard:
# 1. Workers & Pages > ups-tracker-api > Settings > Durable Objects
# 2. Enable Durable Objects
# 3. Create WebSocketState binding (already in wrangler.toml)
```

---

## Database Setup

### Schema Overview

**Tables**:
- `cars`: Package car data (car_id, location, status, timestamps)
- `shifts`: Shift records (start_time, end_time, user_id, notes, snapshot)
- `sessions`: User session tracking (user_id, device_info, heartbeat)
- `usage_events`: Analytics events (event_type, metadata, user_id)
- `audit_logs`: Change history (car_id, change_type, old_value, new_value, user_id)
- `push_subscriptions`: Web push notification subscriptions

### Manual Database Operations

```bash
# Query database
wrangler d1 execute ups-tracker-db --command "SELECT COUNT(*) FROM cars"

# Export data
wrangler d1 export ups-tracker-db --output backup.sql

# Import data
wrangler d1 execute ups-tracker-db --file backup.sql

# Interactive SQL
wrangler d1 execute ups-tracker-db --command "SELECT * FROM shifts ORDER BY start_time DESC LIMIT 5"
```

### Backup Strategy

```bash
# Daily backup script (add to cron)
#!/bin/bash
DATE=$(date +%Y%m%d)
wrangler d1 export ups-tracker-db --output "backups/ups-tracker-${DATE}.sql"

# Keep last 30 days
find backups/ -name "ups-tracker-*.sql" -mtime +30 -delete
```

---

## Post-Deployment Verification

### Frontend Checks

```bash
# 1. Access application
open https://YOUR_DOMAIN.pages.dev

# 2. Check browser console for errors (F12)
# Should see: "UPS Package Car Tracker initialized"

# 3. Verify service worker registration
# DevTools > Application > Service Workers
# Should show: "sw.js" status "activated"

# 4. Test offline mode
# DevTools > Network > Offline checkbox
# Refresh page - should load from cache
```

### Backend API Checks

```bash
# 1. Health check (manual - add endpoint if needed)
curl https://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev/health

# 2. Test CORS
curl -H "Origin: https://YOUR_DOMAIN.pages.dev" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev/api/cars

# 3. WebSocket connection test
# Open browser console on app:
# ws = new WebSocket('wss://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev/ws')
# Should connect successfully
```

### Database Checks

```bash
# Verify tables exist
wrangler d1 execute ups-tracker-db --command "SELECT name FROM sqlite_master WHERE type='table'"

# Check data
wrangler d1 execute ups-tracker-db --command "SELECT COUNT(*) as car_count FROM cars"
wrangler d1 execute ups-tracker-db --command "SELECT COUNT(*) as shift_count FROM shifts"
wrangler d1 execute ups-tracker-db --command "SELECT COUNT(*) as session_count FROM sessions WHERE end_time IS NULL"
```

### E2E Test Suite

```bash
# Run full E2E tests against production
source dev-shell.sh
ups_e2e --headed

# Or specific tests
npx playwright test core-features.spec.js --project=chromium
```

### Monitoring Checklist

- [ ] Frontend loads without console errors
- [ ] Service worker activates successfully
- [ ] Dark mode toggle works
- [ ] Can add/update/delete cars
- [ ] WebSocket connects and syncs in real-time
- [ ] Shift start/end creates database records
- [ ] User identification prompts on first visit
- [ ] CSV import/export functions correctly
- [ ] Active user count displays accurately
- [ ] Audit log shows change history

---

## Troubleshooting

### Frontend Issues

#### "Failed to fetch" errors

**Cause**: CORS misconfiguration or wrong API URL

**Fix**:
```bash
# 1. Verify VITE_API_URL in .env matches deployed Worker URL
# 2. Check workers/wrangler.toml ALLOWED_ORIGINS includes your frontend domain
# 3. Redeploy Worker with correct CORS settings
```

#### Service Worker not registering

**Cause**: HTTP instead of HTTPS, or browser cache

**Fix**:
```bash
# 1. Ensure site is HTTPS (Cloudflare Pages auto-provides)
# 2. Clear browser cache and hard reload (Ctrl+Shift+R)
# 3. Check DevTools > Application > Service Workers for errors
# 4. Verify sw.js exists in dist/ after build
```

#### WebSocket connection fails

**Cause**: Wrong WebSocket URL or Durable Objects not enabled

**Fix**:
```bash
# 1. WebSocket URL should be wss:// not ws:// in production
# 2. Check Durable Objects enabled in Cloudflare dashboard
# 3. Verify WebSocketState binding in wrangler.toml
# 4. Check browser console for specific error message
```

#### Dark mode not working

**Cause**: Fixed in commit 3a992c5 - ensure using latest code

**Fix**:
```bash
# Verify tailwind.config.js has:
# darkMode: 'class'

# Rebuild and redeploy
npm run build
npx wrangler pages deploy dist
```

### Backend Issues

#### Database migration fails

**Cause**: Migration already applied or syntax error

**Fix**:
```bash
# Check migration status
wrangler d1 migrations list ups-tracker-db

# If stuck, manually check:
wrangler d1 execute ups-tracker-db --command "SELECT * FROM d1_migrations"

# Force reapply (dangerous - test locally first):
wrangler d1 migrations apply ups-tracker-db --local
```

#### API returns 500 errors

**Cause**: Database query error or missing environment variable

**Fix**:
```bash
# Check Worker logs
wrangler tail ups-tracker-api

# Common issues:
# - D1 binding not configured in wrangler.toml
# - Database ID incorrect
# - Migration not applied
```

#### WebSocket disconnects immediately

**Cause**: Durable Objects quota exceeded or misconfigured

**Fix**:
```bash
# Check Durable Objects dashboard for errors
# Verify binding in wrangler.toml:
# [[durable_objects.bindings]]
# name = "WEBSOCKET_STATE"
# class_name = "WebSocketState"

# Redeploy Worker
wrangler deploy
```

### Performance Issues

#### Slow API responses

**Cause**: Missing database indexes or N+1 queries

**Fix**:
```bash
# Add indexes (already in 0001_initial_schema.sql):
# CREATE INDEX idx_cars_location ON cars(location)
# CREATE INDEX idx_audit_logs_car_id ON audit_logs(car_id)

# Verify indexes exist:
wrangler d1 execute ups-tracker-db --command "SELECT * FROM sqlite_master WHERE type='index'"
```

#### High memory usage in browser

**Cause**: Too many cars or large audit logs

**Fix**:
```javascript
// Limit query results in frontend:
// auditApi.getLogs(carId, { limit: 50 })  // Already implemented

// Consider pagination for >1000 cars
// Implement virtual scrolling for large lists
```

---

## Rollback Procedures

### Frontend Rollback

```bash
# Cloudflare Pages - rollback via dashboard:
# 1. Pages > ups-tracker > Deployments
# 2. Find previous working deployment
# 3. Click "..." > "Rollback to this deployment"

# Or redeploy previous git commit:
git checkout <previous-commit-hash>
npm run build
npx wrangler pages deploy dist
```

### Backend Rollback

```bash
# Workers rollback
wrangler rollback ups-tracker-api

# Or deploy previous version:
git checkout <previous-commit-hash>
cd workers/
wrangler deploy
```

### Database Rollback

```bash
# Restore from backup
wrangler d1 execute ups-tracker-db --file backups/ups-tracker-20251122.sql

# WARNING: This will overwrite all data since backup
# Consider exporting current state first:
wrangler d1 export ups-tracker-db --output pre-rollback.sql
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Run full test suite: `npm test && npx playwright test`
- [ ] Run linter: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup current production data
- [ ] Review CHANGELOG.md

### Deployment Steps

- [ ] Deploy backend Worker first
- [ ] Apply database migrations
- [ ] Verify backend API responds
- [ ] Deploy frontend to Pages
- [ ] Verify frontend loads
- [ ] Test critical user flows
- [ ] Check WebSocket connections
- [ ] Monitor error logs for 15 minutes

### Post-Deployment

- [ ] Verify active user count updates
- [ ] Test shift start/end
- [ ] Confirm CSV import/export works
- [ ] Check audit logs recording changes
- [ ] Test on mobile devices
- [ ] Update team on deployment
- [ ] Tag release in git: `git tag v1.0.0 && git push --tags`

---

## Production URLs

### Frontend
- **Production**: `https://ups-tracker.pages.dev` (or custom domain)
- **Preview**: `https://BRANCH.ups-tracker.pages.dev`

### Backend
- **API**: `https://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev`
- **WebSocket**: `wss://ups-tracker-api.YOUR_SUBDOMAIN.workers.dev/ws`

### Cloudflare Dashboard
- **Pages**: https://dash.cloudflare.com/?to=/:account/pages
- **Workers**: https://dash.cloudflare.com/?to=/:account/workers
- **D1**: https://dash.cloudflare.com/?to=/:account/d1

---

## Security Considerations

### Production Hardening

1. **CORS Configuration**
   ```toml
   # workers/wrangler.toml
   [vars]
   ALLOWED_ORIGINS = "https://your-production-domain.com"
   ```

2. **Rate Limiting** (add to Worker)
   ```javascript
   // Implement rate limiting for API endpoints
   // Consider Cloudflare rate limiting rules
   ```

3. **Input Validation**
   - Car IDs validated (alphanumeric, max length)
   - Status values whitelisted
   - Location values restricted
   - Already implemented in PackageCarTracker.jsx

4. **Content Security Policy**
   ```html
   <!-- Add to index.html -->
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'self'; connect-src 'self' https://*.workers.dev wss://*.workers.dev">
   ```

### Secrets Management

```bash
# Store VAPID private key as Worker secret (not in wrangler.toml)
wrangler secret put VAPID_PRIVATE_KEY

# Access in Worker code:
# env.VAPID_PRIVATE_KEY
```

---

## Support & Resources

- **Issue Tracker**: GitHub Issues
- **Documentation**: README.md, RUTHLESS_AUDIT.md
- **E2E Tests**: e2e/ directory
- **Dev Shell**: `source dev-shell.sh && ups_help`
- **Cloudflare Docs**: https://developers.cloudflare.com/

---

**Last Verified**: November 23, 2025  
**Deploy Status**: Ready for production (89% complete - see RUTHLESS_AUDIT.md)
