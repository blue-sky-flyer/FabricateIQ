// Cloudflare Worker - FabricateIQ Claude proxy (fabricateiq-proxy)
// Routes Claude API calls through secure proxy with SKILL.md system prompt

import {
  getCorsHeaders,
  handleCorsPreflightIfNeeded,
  authenticateRequest,
  validateBodySize,
  sanitizeError,
  fetchWithTimeout,
  validateMessages,
  checkRateLimit
} from './middleware.js';

const SKILL_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/skills/quote-generator/SKILL.md';
const CATALOG_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/MASTER_CATALOG.md';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    const preflightResponse = handleCorsPreflightIfNeeded(request);
    if (preflightResponse) return preflightResponse;

    const corsHeaders = getCorsHeaders(request);

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limit check
    const rateLimitResponse = checkRateLimit(request, corsHeaders);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication check
    const authResponse = authenticateRequest(request, env, corsHeaders);
    if (authResponse) return authResponse;

    // Body size check
    const sizeResponse = validateBodySize(request, corsHeaders);
    if (sizeResponse) return sizeResponse;

    try {
      // Fetch SKILL.md and MASTER_CATALOG at runtime (with timeout)
      const [skillRes, catalogRes] = await Promise.all([
        fetchWithTimeout(SKILL_URL),
        fetchWithTimeout(CATALOG_URL)
      ]);

      if (!skillRes.ok || !catalogRes.ok) {
        throw new Error('Failed to fetch skill or catalog from GitHub');
      }

      const skillContent = await skillRes.text();
      const catalogContent = await catalogRes.text();

      const systemPrompt = `${skillContent}\n\n---\n\n# REFERENCE DATA\n${catalogContent}`;

      const body = await request.json();

      // Validate messages
      const msgError = validateMessages(body.messages);
      if (msgError) {
        return new Response(JSON.stringify({ error: msgError }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Call Claude API (Sonnet 4.5)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          system: systemPrompt,
          messages: body.messages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Claude API error: ${response.status} - ${errorText}`);
        throw new Error('AI service temporarily unavailable');
      }

      return new Response(await response.text(), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify(sanitizeError(error)), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
