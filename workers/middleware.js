// Shared security middleware for Cloudflare Workers

const ALLOWED_ORIGINS = [
  'https://fabricateiq.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

/**
 * Build CORS headers for the given request origin.
 * Returns 403 response if origin is not whitelisted (for preflight).
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

/**
 * Handle CORS preflight. Returns Response or null if not OPTIONS.
 */
export function handleCorsPreflightIfNeeded(request) {
  if (request.method !== 'OPTIONS') return null;

  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, { headers: getCorsHeaders(request) });
}

/**
 * Verify Bearer token matches env.WORKER_AUTH_TOKEN.
 * Returns error Response or null if valid.
 */
export function authenticateRequest(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token || token !== env.WORKER_AUTH_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return null;
}

/**
 * Reject requests with body larger than maxBytes.
 * Returns error Response or null if within limit.
 */
export function validateBodySize(request, corsHeaders, maxBytes = 100_000) {
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > maxBytes) {
    return new Response(JSON.stringify({ error: 'Request too large' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null;
}

/**
 * Return a generic error message. Never forward raw API error details.
 */
export function sanitizeError(error) {
  // Log full error for server-side debugging (visible in Worker logs)
  console.error('[Worker Error]', error.message || error);

  return {
    error: 'An error occurred processing your request. Please try again.',
    type: 'worker_error'
  };
}

/**
 * Fetch with timeout using AbortController.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Clean AI response text: strip markdown fences and extract JSON object.
 */
export function cleanJsonFromAI(text) {
  let cleaned = (text || '').trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Validate messages array structure.
 * Returns error string or null if valid.
 */
export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages must be a non-empty array';
  }

  if (messages.length > 20) {
    return 'Too many messages (max 20)';
  }

  for (const msg of messages) {
    if (!msg.role || typeof msg.role !== 'string') {
      return 'Each message must have a string role';
    }
    if (msg.content === undefined || msg.content === null) {
      return 'Each message must have content';
    }
  }

  return null;
}

const ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash',
  'gemini-3-pro',
  'gemini-3-pro-preview'
];

/**
 * Validate model name against allowlist.
 * Returns the model (defaulting to gemini-2.5-flash) or throws.
 */
export function validateModel(model) {
  const resolved = model || 'gemini-2.5-flash';
  if (!ALLOWED_MODELS.includes(resolved)) {
    throw new Error(`Unknown model: ${resolved}`);
  }
  return resolved;
}

// Simple in-memory rate limiter (per-isolate, resets on cold start)
const requestLog = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

/**
 * Check rate limit for IP. Returns error Response or null if allowed.
 */
export function checkRateLimit(request, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();

  const timestamps = requestLog.get(ip) || [];
  // Remove entries outside the window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
    });
  }

  recent.push(now);
  requestLog.set(ip, recent);

  // Periodic cleanup: remove stale IPs every 100 requests
  if (requestLog.size > 100) {
    for (const [key, times] of requestLog) {
      const active = times.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (active.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, active);
      }
    }
  }

  return null;
}
