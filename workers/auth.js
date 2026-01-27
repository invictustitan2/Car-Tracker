/**
 * Authentication and Authorization Utilities
 * 
 * Provides API key validation and rate limiting
 */

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  constructor(message, retryAfter = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Validate API key from request headers
 */
export async function validateApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    console.error('[Auth] Missing API key in request headers');
    throw new AuthenticationError('Missing API key');
  }
  
  // Check against environment variable
  // In production, this should be a Cloudflare secret
  const validKey = env.API_SECRET_KEY;
  
  if (!validKey) {
    console.error('API_SECRET_KEY not configured in environment');
    throw new AuthenticationError('API authentication not configured');
  }
  
  if (apiKey !== validKey) {
    console.error(`[Auth] Invalid API key. Received: ${apiKey.substring(0, 3)}***, Expected: ${validKey.substring(0, 3)}***`);
    throw new AuthenticationError('Invalid API key');
  }

  
  return true;
}

/**
 * Check rate limiting using Cloudflare KV
 * Implements sliding window rate limiting
 */
export async function checkRateLimit(env, clientIP, endpoint) {
  const shouldBypass = env.DISABLE_RATE_LIMIT === '1' || env.DISABLE_RATE_LIMIT === 'true';
  if (shouldBypass) {
    console.warn('Rate limiting disabled via DISABLE_RATE_LIMIT flag');
    return;
  }

  // Skip rate limiting if KV not configured (development)
  if (!env.RATE_LIMIT_KV) {
    console.warn('RATE_LIMIT_KV not configured, skipping rate limit check');
    return;
  }
  
  const key = `ratelimit:${clientIP}:${endpoint}`;
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  const maxRequests = 100; // 100 requests per minute per IP per endpoint
  
  try {
    // Get current request count from KV
    const dataStr = await env.RATE_LIMIT_KV.get(key);
    
    if (dataStr) {
      const data = JSON.parse(dataStr);
      const { count, resetAt } = data;
      
      if (now < resetAt) {
        // Still within the current window
        if (count >= maxRequests) {
          const retryAfter = Math.ceil((resetAt - now) / 1000);
          throw new RateLimitError(
            `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter
          );
        }
        
        // Increment counter
        const ttlSeconds = Math.max(60, Math.ceil((resetAt - now) / 1000));

        await env.RATE_LIMIT_KV.put(
          key,
          JSON.stringify({
            count: count + 1,
            resetAt
          }),
          { expirationTtl: ttlSeconds }
        );
      } else {
        // Window expired, start new window
        await env.RATE_LIMIT_KV.put(
          key,
          JSON.stringify({
            count: 1,
            resetAt: now + windowMs
          }),
          { expirationTtl: 60 }
        );
      }
    } else {
      // First request, create new window
      await env.RATE_LIMIT_KV.put(
        key,
        JSON.stringify({
          count: 1,
          resetAt: now + windowMs
        }),
        { expirationTtl: 60 }
      );
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    // Don't fail requests if rate limiting fails
    console.error('Rate limit check failed:', error);
  }
}

/**
 * Get allowed CORS origins based on environment
 */
export function getAllowedOrigins(env) {
  // Default allowed origins
  const origins = [
    'https://ups-tracker.aperion.cc',
    'https://tracker.aperion.cc',
    'https://ups-tracker.pages.dev',
    'https://main.ups-tracker.pages.dev',
    'https://*.ups-tracker.pages.dev',
  ];
  
  // Add custom origins from environment
  if (env.ALLOWED_ORIGINS) {
    const customOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    origins.push(...customOrigins);
  }
  
  // Add localhost in development and for E2E testing
  // if (env.ENVIRONMENT === 'development') {
    origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  // }
  
  return origins;
}

/**
 * Get CORS headers with proper origin validation
 */
export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);

  const matchedOrigin = matchOrigin(origin, allowedOrigins);
  const allowedOrigin = matchedOrigin || allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

function matchOrigin(origin, allowedOrigins) {
  if (!origin) {
    return null;
  }

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch (error) {
    console.warn('Invalid Origin header received:', origin, error);
    return null;
  }

  for (const allowed of allowedOrigins) {
    if (isExactOriginMatch(originUrl, allowed) || isWildcardOriginMatch(originUrl, allowed)) {
      return origin;
    }
  }

  return null;
}

function isExactOriginMatch(originUrl, allowed) {
  if (!allowed || allowed.includes('*')) {
    return false;
  }

  try {
    const allowedUrl = new URL(allowed);
    return (
      allowedUrl.protocol === originUrl.protocol &&
      allowedUrl.host === originUrl.host
    );
  } catch {
    return false;
  }
}

function isWildcardOriginMatch(originUrl, allowed) {
  if (!allowed || !allowed.includes('*')) {
    return false;
  }

  const [scheme, hostPattern] = allowed.split('://');
  if (!scheme || !hostPattern || !hostPattern.startsWith('*.')) {
    return false;
  }

  const requiredProtocol = `${scheme}:`;
  if (originUrl.protocol !== requiredProtocol) {
    return false;
  }

  const baseHost = hostPattern.slice(2);
  return (
    originUrl.hostname === baseHost ||
    originUrl.hostname.endsWith(`.${baseHost}`)
  );
}

/**
 * Validate WebSocket authentication token
 */
export async function validateWebSocketToken(token, env) {
  if (!token) {
    throw new AuthenticationError('Missing WebSocket authentication token');
  }
  
  // Validate token is a valid session ID
  const stmt = env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND ended_at IS NULL'
  );
  const session = await stmt.bind(token).first();
  
  if (!session) {
    throw new AuthenticationError('Invalid or expired session token');
  }
  
  return session;
}

/**
 * Get client IP address from request
 */
export function getClientIP(request) {
  // Cloudflare provides the real IP in this header
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0] ||
         'unknown';
}
