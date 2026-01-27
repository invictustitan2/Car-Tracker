# Quick Reference - Security Implementation

## For Developers

### API Requests (Frontend)

All API requests now require authentication:

```javascript
// ❌ Before (insecure)
fetch('https://api.example.com/api/cars')

// ✅ After (secure)
fetch('https://api.example.com/api/cars', {
  headers: {
    'X-API-Key': process.env.VITE_API_KEY
  }
})
```

The `apiClient.js` automatically adds the header if `VITE_API_KEY` is set.

### WebSocket Connections (Frontend)

WebSocket connections require session tokens:

```javascript
// ❌ Before (insecure)
wsService.connect(wsUrl, userId)

// ✅ After (secure)
wsService.connect(wsUrl, userId, sessionToken)
```

### Environment Variables

**Frontend (.env):**
```bash
VITE_API_KEY=your-secret-key-here
VITE_API_URL=https://ups-tracker-api.invictustitan2.workers.dev
VITE_ENABLE_SYNC=true
```

**Backend (Cloudflare Worker secrets):**
```bash
wrangler secret put API_SECRET_KEY
# Enter: same value as VITE_API_KEY
```

### Testing Locally

1. Copy `.env.example` to `.env`
2. Generate API key: `openssl rand -base64 32`
3. Set `VITE_API_KEY` in `.env`
4. Set `API_SECRET_KEY` in worker: `cd workers && wrangler secret put API_SECRET_KEY`
5. Start dev server: `npm run dev`

### Common Errors

**401 Unauthorized**
- Missing X-API-Key header
- Incorrect API key
- Fix: Check VITE_API_KEY in .env matches API_SECRET_KEY in worker

**429 Too Many Requests**
- Rate limit exceeded (100 req/min per IP)
- Wait 60 seconds or use different IP

**400 Bad Request with "Validation failed"**
- Invalid input (e.g., car ID with special characters)
- Fix: Check input against validation rules in `workers/validators.js`

**403 Forbidden (CORS)**
- Origin not in ALLOWED_ORIGINS
- Fix: Add your domain to ALLOWED_ORIGINS in wrangler.toml

### Input Validation Rules

| Field | Rules | Example |
|-------|-------|---------|
| Car ID | A-Z, 0-9, dash only, 1-50 chars | `CAR-123` ✅ `<script>` ❌ |
| User ID | 1-100 chars, no SQL chars | `user@example.com` ✅ `'; DROP TABLE--` ❌ |
| Location | Whitelist only | `Yard`, `100`, `Shop` ✅ `Warehouse` ❌ |
| Notes | Max 1000 chars | Short text ✅ Novel ❌ |
| Shift Notes | Max 5000 chars | Detailed text ✅ |

### Rate Limits

- **Per IP per endpoint**: 100 requests/minute
- **Sliding window**: 60 seconds
- **Returns**: 429 Too Many Requests
- **Headers**: Check `X-RateLimit-Limit`, `X-RateLimit-Remaining` (future)

### Security Checklist

Before committing code:

- [ ] Never hardcode API keys in code
- [ ] Always use environment variables
- [ ] Validate user input on frontend before sending
- [ ] Handle 401, 429, 400 errors gracefully
- [ ] Don't log sensitive data (API keys, tokens)
- [ ] Use HTTPS in production
- [ ] Test with invalid inputs

### Quick Commands

```bash
# Generate API key
openssl rand -base64 32

# Set Worker secret
cd workers && wrangler secret put API_SECRET_KEY

# Deploy Worker
cd workers && wrangler deploy

# Test API (replace YOUR_KEY and URL)
curl -H "X-API-Key: YOUR_KEY" https://ups-tracker-api.invictustitan2.workers.dev/api/health

# Check rate limit
for i in {1..105}; do curl -H "X-API-Key: YOUR_KEY" https://...api/health; done
```

### Where to Find More Info

- **Security Guide**: `docs/SECURITY.md`
- **Setup Script**: `scripts/setup-security.sh`
- **Validators**: `workers/validators.js`
- **Auth Logic**: `workers/auth.js`
- **Audit Report**: `COMPREHENSIVE_CODE_AUDIT.md`
- **Deployment**: `DEPLOYMENT.md`

### Support

For issues:
1. Check error message
2. Verify environment variables
3. Check Cloudflare Worker logs
4. See `docs/SECURITY.md` troubleshooting section
