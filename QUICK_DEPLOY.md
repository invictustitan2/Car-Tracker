# Quick Deployment Guide - Security-Enabled Version

## Current Status
- ✅ P0 Security Implementation Complete
- ✅ Production Build Working (264K JS, 44K CSS)
- ⏳ Ready to Deploy (pending configuration)

## Prerequisites
1. Cloudflare account with wrangler CLI installed
2. GitHub account (for frontend deployment)

## Step 1: Configure Security (One-Time Setup)

### A. Generate API Secret Key
```bash
# Generate a secure random key
openssl rand -base64 32
# Example output: xK9mP2wQ7vR5tN8cL3jH6fB4dS1gY0oU9iE2aW7zX5

# Save this for later - you'll need it for both worker and frontend
```

### B. Create Cloudflare KV Namespace
```bash
cd /home/dreamboat/projects/ups-tracker/workers

# Login to Cloudflare
wrangler login

# Create KV namespace for rate limiting
wrangler kv:namespace create RATE_LIMIT_KV

# Example output:
# 🌀 Creating namespace with title "ups-tracker-api-RATE_LIMIT_KV"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "RATE_LIMIT_KV", id = "abc123def456..." }

# Copy the ID from output
```

### C. Update wrangler.toml
```bash
# Edit workers/wrangler.toml
# Replace 'create-this-namespace' with the actual KV namespace ID
```

Example:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "abc123def456..."  # Use your actual ID
preview_id = "preview-id"  # Optional for dev
```

### D. Set Worker Secrets
```bash
cd workers

# Set API secret key (paste the key from Step A)
wrangler secret put API_SECRET_KEY
# When prompted, paste: xK9mP2wQ7vR5tN8cL3jH6fB4dS1gY0oU9iE2aW7zX5

# Verify VAPID key is still set (should already exist)
wrangler secret list
```

### E. Configure CORS
```bash
# For production, set allowed origins
# Option 1: Via Cloudflare dashboard
#   - Go to Workers & Pages > ups-tracker-api > Settings > Environment Variables
#   - Add: ALLOWED_ORIGINS = https://yourdomain.com,https://www.yourdomain.com

# Option 2: Via wrangler.toml (less secure, commits to git)
# [vars]
# ALLOWED_ORIGINS = "https://yourdomain.com"
```

## Step 2: Deploy Worker

```bash
cd /home/dreamboat/projects/ups-tracker/workers

# Deploy with security modules
wrangler deploy

# Expected output:
# Uploaded ups-tracker-api (X.XX sec)
# Published ups-tracker-api (X.XX sec)
#   https://ups-tracker-api.invictustitan2.workers.dev
# Current Deployment ID: abc123...
```

### Verify Deployment
```bash
# Test health endpoint (should return 401 without API key)
curl https://ups-tracker-api.invictustitan2.workers.dev/api/health
# Expected: {"error":"Authentication required"}

# Test with API key (should return 200)
curl -H "X-API-Key: xK9mP2wQ7vR5tN8cL3jH6fB4dS1gY0oU9iE2aW7zX5" \
  https://ups-tracker-api.invictustitan2.workers.dev/api/health
# Expected: {"status":"ok","timestamp":"2025-11-23T..."}
```

## Step 3: Deploy Frontend

### A. Update Frontend Environment
```bash
cd /home/dreamboat/projects/ups-tracker

# Create/update .env file
cat > .env << EOF
VITE_API_URL=https://ups-tracker-api.invictustitan2.workers.dev
VITE_API_KEY=xK9mP2wQ7vR5tN8cL3jH6fB4dS1gY0oU9iE2aW7zX5
VITE_ENABLE_SYNC=true
EOF
```

### B. Build Frontend
```bash
npm run build

# Verify build
ls -lh dist/
# Should see index.html and assets/
```

### C. Deploy to Cloudflare Pages
```bash
# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name ups-tracker

# Expected output:
# ✨ Success! Uploaded X files (X.XX sec)
# ✨ Deployment complete! Take a peek over at https://abc123.ups-tracker.pages.dev
```

### D. Add Environment Variables to Pages
```bash
# Via Cloudflare dashboard:
# 1. Go to Workers & Pages > ups-tracker
# 2. Settings > Environment Variables
# 3. Add:
#    - VITE_API_KEY (same as worker API_SECRET_KEY)
#    - VITE_API_URL (worker URL)
#    - VITE_ENABLE_SYNC = true
# 4. Redeploy
```

## Step 4: Verify End-to-End

### Test the Deployed App
```bash
# 1. Open deployed URL
# https://abc123.ups-tracker.pages.dev

# 2. Open browser console (F12)
# 3. Check for errors - should see no authentication errors
# 4. Add a car - should sync to worker
# 5. Refresh page - car should persist
```

### Monitor Security
```bash
# Check Cloudflare Analytics for:
# - 401 responses (authentication failures)
# - 429 responses (rate limit hits)
# - Request patterns

# View logs
wrangler tail ups-tracker-api
```

## Rollback Plan

If issues occur:

### Rollback Worker
```bash
cd workers

# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [DEPLOYMENT_ID]
```

### Rollback Frontend
```bash
# Cloudflare Pages keeps previous deployments
# Go to dashboard > Workers & Pages > ups-tracker > Deployments
# Click "Rollback" on previous working deployment
```

## Automated Deployment (Future)

Once tested, add to CI/CD:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: workers
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci && npm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ups-tracker
          directory: dist
```

## Troubleshooting

### Issue: 401 Authentication Required
- Verify API key is set in worker secrets
- Verify frontend .env has matching VITE_API_KEY
- Check browser network tab - X-API-Key header should be sent

### Issue: 429 Rate Limit Exceeded
- Normal for testing - wait 60 seconds
- Or temporarily increase limit in workers/auth.js
- Check KV namespace is correctly bound

### Issue: CORS Error
- Verify ALLOWED_ORIGINS includes your domain
- Check browser origin matches exactly
- For development: Use http://localhost:5173

### Issue: WebSocket Connection Failed
- Verify session is started before WebSocket connect
- Check session token is being passed
- View worker logs: `wrangler tail`

## Next Steps

After successful deployment:
1. ✅ Test all features on staging URL
2. ✅ Run floor test validation on actual devices
3. ✅ Monitor for 24 hours
4. ✅ Update DNS to point production domain
5. ✅ Enable Cloudflare caching rules
6. ✅ Set up monitoring/alerts

## Reference

- Security Implementation: `P0_SECURITY_COMPLETE.md`
- Security Guide: `docs/SECURITY.md`
- Quick Reference: `SECURITY_QUICKREF.md`
- Full Deployment: `DEPLOYMENT.md`
