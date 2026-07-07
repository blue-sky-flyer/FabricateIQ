/**
 * API mock helpers for FabricateIQ E2E tests.
 *
 * Two external endpoints are called by the app:
 *   - CLAUDE_WORKER_URL  (analyzeWithClaude)   → vision/PDF analysis
 *   - GEMINI_WORKER_URL  (fetchAIQuote, chat)   → quote generation
 *
 * Call setupApiMocks(page) at the start of every test (or in beforeEach) to
 * intercept both URLs and return controlled fixture responses.
 */

export const CLAUDE_WORKER_URL = 'https://fabricateiq-proxy.sp9n.workers.dev';
export const GEMINI_WORKER_URL = 'https://fabricateiq-gemini.sp9n.workers.dev';

/**
 * Successful Claude analysis response — mimics a real Anthropic content block.
 */
export const MOCK_CLAUDE_ANALYSIS = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        wallSqft: 400,
        floorSqft: 200,
        wallType: 'paintedMDF',
        floorType: 'standardCarpet',
        graphics: 'moderate',
        graphicsEstimate: 5000,
      }),
    },
  ],
};

/**
 * Successful Gemini quote response — minimal structure matching QuoteResult expectations.
 */
export const MOCK_GEMINI_QUOTE = {
  quote: {
    project_overview: {
      dimensions: '10ft x 20ft',
      location: 'Toronto',
      environment: 'indoor',
      duration_days: 3,
      total_sqft: 200,
    },
    materials: { total: 20000, items: [] },
    services: { total: 8000, items: [] },
    subtotal: 28000,
    tax: { rate: 0.13, amount: 3640, label: 'HST 13%' },
    grand_total: 31640,
    currency: 'CAD',
  },
  model: 'gemini-3-pro-preview',
  usage: { input_tokens: 500, output_tokens: 300 },
};

/**
 * Wire up route interception for both workers on the given page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [overrides]
 * @param {object|null} [overrides.claudeResponse] - Override Claude response body (null = network error)
 * @param {object|null} [overrides.geminiResponse] - Override Gemini response body (null = network error)
 * @param {number}      [overrides.claudeStatus]   - HTTP status code for Claude mock (default 200)
 * @param {number}      [overrides.geminiStatus]   - HTTP status code for Gemini mock (default 200)
 */
export async function setupApiMocks(page, overrides = {}) {
  const {
    claudeResponse = MOCK_CLAUDE_ANALYSIS,
    geminiResponse = MOCK_GEMINI_QUOTE,
    claudeStatus = 200,
    geminiStatus = 200,
  } = overrides;

  await page.route(`${CLAUDE_WORKER_URL}/**`, async (route) => {
    if (claudeResponse === null) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: claudeStatus,
      contentType: 'application/json',
      body: JSON.stringify(claudeResponse),
    });
  });

  await page.route(CLAUDE_WORKER_URL, async (route) => {
    if (claudeResponse === null) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: claudeStatus,
      contentType: 'application/json',
      body: JSON.stringify(claudeResponse),
    });
  });

  await page.route(`${GEMINI_WORKER_URL}/**`, async (route) => {
    if (geminiResponse === null) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: geminiStatus,
      contentType: 'application/json',
      body: JSON.stringify(geminiResponse),
    });
  });

  await page.route(GEMINI_WORKER_URL, async (route) => {
    if (geminiResponse === null) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: geminiStatus,
      contentType: 'application/json',
      body: JSON.stringify(geminiResponse),
    });
  });
}
