# Security Implementation Guide

## Overview

This document describes the security implementation for the UPS Package Car Tracker application, including authentication, authorization, input validation, rate limiting, and CORS configuration.

## Security Features Implemented

### 1. API Authentication

**Implementation:** `workers/auth.js` - `validateApiKey()`

All API requests (except OPTIONS preflight) require authentication via API key.

**How it works:**
- Client sends API key in `X-API-Key` header
- Worker validates against `API_SECRET_KEY` environment variable
- Returns 401 Unauthorized if missing or invalid

**Setup:**
```bash
# Generate a secure API key
openssl rand -base64 32

# Set as Cloudflare Worker secret
wrangler secret put API_SECRET_KEY
```

**Frontend configuration:**
```env
# .env
VITE_API_KEY=your-api-key-here
```

### 2. Rate Limiting

**Implementation:** `workers/auth.js` - `checkRateLimit()`

Prevents abuse by limiting requests per IP address per endpoint.

**How it works:**
- Uses Cloudflare KV for distributed rate limiting
- Sliding window algorithm (60-second windows)
- Default: 100 requests per minute per IP per endpoint
- Returns 429 Too Many Requests when exceeded

**Storage:**
- KV Key: `ratelimit:{IP}:{endpoint}:{window}`
- Value: Request count
- TTL: 120 seconds (2 windows for sliding window calculation)

**Configuration:**
```toml
# workers/wrangler.toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"
```

### 3. CORS Protection

**Implementation:** `workers/auth.js` - `getCorsHeaders()`

Prevents unauthorized cross-origin requests.

**How it works:**
- Validates request `Origin` header against whitelist
- Returns appropriate CORS headers only for allowed origins
- No more wildcard (`*`) origins in production

**Configuration:**
```toml
# workers/wrangler.toml
[vars]
ENVIRONMENT = "production"
# ALLOWED_ORIGINS = "https://yourdomain.com,https://www.yourdomain.com"
```

**Development vs Production:**
- Development: Allows `http://localhost:5173` and `http://localhost:8787`
- Production: Only allows origins from `ALLOWED_ORIGINS` environment variable

### 4. Input Validation

**Implementation:** `workers/validators.js`

Validates all user inputs to prevent injection attacks.

**Validators:**

| Validator | Purpose | Rules |
|-----------|---------|-------|
| `carId()` | Car ID validation | Alphanumeric + dash, 1-50 chars, regex `^[A-Z0-9-]{1,50}$` |
| `userId()` | User ID validation | 1-100 chars, blocks SQL/XSS chars: `< > " ' ; -- /* */` |
| `location()` | Location validation | Whitelist: Yard, 100-600, Shop |
| `notes()` | Car notes validation | Max 1000 characters |
| `shiftNotes()` | Shift notes validation | Max 5000 characters |
| `sessionId()` | Session ID validation | UUID v4 format |
| `pagination()` | Limit/offset validation | Limit: 1-1000, offset: ≥0 |
| `requestBodySize()` | Request size validation | Max 100KB |

**CSV Injection Prevention:**
```javascript
sanitizeCsvField(field)
```
- Detects formula prefixes: `=`, `+`, `-`, `@`, `\t`, `\r`
- Prefixes dangerous values with single quote

**Example usage:**
```javascript
Validators.carId(carId);  // Throws ValidationError if invalid
Validators.userId(userId);
Validators.location(location);
```

### 5. WebSocket Authentication

**Implementation:** `workers/auth.js` - `validateWebSocketToken()`

Secures WebSocket connections with session-based authentication.

**How it works:**
- Client passes `token` query parameter (session ID)
- Worker validates token exists in database
- Returns session data if valid
- Closes connection with 1008 code if invalid

**Frontend:**
```javascript
wsService.connect(wsUrl, userId, sessionToken);
// Connects to: ws://api.example.com/api/ws?token=session-uuid
```

### 6. Error Handling

**Implementation:** `workers/api.js` - Enhanced error handler

Prevents information disclosure while providing useful feedback.

**How it works:**
- Development: Returns full error messages
- Production: Hides internal error details
- Custom error types with appropriate HTTP status codes:
  - `AuthenticationError` → 401
  - `RateLimitError` → 429
  - `ValidationError` → 400

**Example:**
```javascript
// Development response
{ "error": "Internal server error", "message": "Database connection failed" }

// Production response
{ "error": "Internal server error" }
```

## Setup Instructions

### 1. Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create RATE_LIMIT_KV

# Create preview namespace
wrangler kv:namespace create RATE_LIMIT_KV --preview

# Update workers/wrangler.toml with the IDs returned
```

### 2. Set Environment Variables

**Cloudflare Worker Secrets:**
```bash
# Generate and set API secret
openssl rand -base64 32 | wrangler secret put API_SECRET_KEY
```

**Cloudflare Worker Variables:**
```bash
# Update workers/wrangler.toml
[vars]
ENVIRONMENT = "production"
# Set ALLOWED_ORIGINS via Cloudflare dashboard or wrangler CLI
```

**Frontend Environment:**
```bash
# Copy template
cp .env.example .env

# Edit .env
VITE_API_KEY=<same-as-API_SECRET_KEY>
VITE_API_URL=https://ups-tracker-api.invictustitan2.workers.dev
```

### 3. Deploy

```bash
# Deploy worker with security modules
cd workers
wrangler deploy

# Test authentication
curl -H "X-API-Key: your-key" https://ups-tracker-api.invictustitan2.workers.dev/api/health
```

## Security Testing

### Test Authentication

```bash
# Should return 401
curl https://ups-tracker-api.invictustitan2.workers.dev/api/cars

# Should return 200
curl -H "X-API-Key: your-key" https://ups-tracker-api.invictustitan2.workers.dev/api/cars
```

### Test Rate Limiting

```bash
# Run 101 requests quickly
for i in {1..101}; do
  curl -H "X-API-Key: your-key" https://ups-tracker-api.invictustitan2.workers.dev/api/health
done
# 101st request should return 429
```

### Test Input Validation

```bash
# Should return 400 - Invalid car ID
curl -X POST -H "X-API-Key: your-key" -H "Content-Type: application/json" \
  -d '{"id":"<script>alert(1)</script>","location":"Yard"}' \
  https://ups-tracker-api.invictustitan2.workers.dev/api/cars

# Should return 200 - Valid car ID
curl -X POST -H "X-API-Key: your-key" -H "Content-Type: application/json" \
  -d '{"id":"CAR123","location":"Yard"}' \
  https://ups-tracker-api.invictustitan2.workers.dev/api/cars
```

### Test CORS

```bash
# Should return CORS headers only for allowed origin
curl -H "Origin: https://yourdomain.com" \
  -H "X-API-Key: your-key" \
  https://ups-tracker-api.invictustitan2.workers.dev/api/cars

# Should return CORS headers without Access-Control-Allow-Origin for disallowed origin
curl -H "Origin: https://evil.com" \
  -H "X-API-Key: your-key" \
  https://ups-tracker-api.invictustitan2.workers.dev/api/cars
```

## Security Checklist

Before deploying to production, ensure:

- [ ] `API_SECRET_KEY` is set as Cloudflare Worker secret (not in code)
- [ ] `VITE_API_KEY` matches `API_SECRET_KEY`
- [ ] KV namespace created and bound to worker
- [ ] `ALLOWED_ORIGINS` set to production domains only (no wildcards)
- [ ] `ENVIRONMENT` set to `production` in wrangler.toml
- [ ] All API requests include `X-API-Key` header
- [ ] WebSocket connections use session tokens
- [ ] Error messages don't expose internal details in production
- [ ] Rate limiting tested and working
- [ ] Input validation tested with malicious inputs
- [ ] CORS tested with unauthorized origins

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ X-API-Key: <secret>
       │ Origin: https://yourdomain.com
       ▼
┌─────────────────────────────────┐
│   Cloudflare Worker API         │
├─────────────────────────────────┤
│ 1. getCorsHeaders()             │ ◄── Validate origin
│ 2. validateApiKey()             │ ◄── Check X-API-Key header
│ 3. checkRateLimit()             │ ◄── Query KV, enforce limits
│ 4. Validators.*()               │ ◄── Validate all inputs
│ 5. Route handler                │
│ 6. Error handler                │ ◄── Hide details in prod
└─────────┬───────────────────────┘
          │
          ▼
    ┌─────────┐
    │  D1 DB  │
    └─────────┘
```

## Compliance

This security implementation addresses:

- **OWASP Top 10 (2021)**
  - A01: Broken Access Control → API authentication
  - A02: Cryptographic Failures → Secrets in env vars
  - A03: Injection → Input validation
  - A04: Insecure Design → Rate limiting, CORS
  - A05: Security Misconfiguration → Proper CORS, error handling
  - A07: Identification and Authentication Failures → API keys, session tokens

- **Production Readiness**
  - Authentication ✅
  - Authorization ✅
  - Input validation ✅
  - Rate limiting ✅
  - CORS protection ✅
  - Error handling ✅
  - WebSocket security ✅

## Monitoring

Monitor these metrics in Cloudflare Analytics:

- **401 Responses:** Unauthorized API access attempts
- **429 Responses:** Rate limit violations
- **400 Responses:** Invalid input attempts
- **KV Operations:** Rate limiting storage usage
- **WebSocket 1008 Closes:** Failed WebSocket authentication

## Future Enhancements

Potential security improvements:

1. **User Authentication:** Replace API key with JWT tokens per user
2. **Role-Based Access Control (RBAC):** Different permissions for different users
3. **Audit Logging:** Log all security events to separate storage
4. **IP Allowlisting:** Restrict API access to specific IP ranges
5. **Request Signing:** HMAC signatures for request integrity
6. **Certificate Pinning:** Pin TLS certificates in frontend
7. **Content Security Policy (CSP):** Add CSP headers to responses
8. **Rate Limiting Tiers:** Different limits for different API keys

## Support

For security issues:
1. Check logs in Cloudflare dashboard
2. Review `COMPREHENSIVE_CODE_AUDIT.md` for known issues
3. Test with security testing procedures above
4. Contact: See README.md
