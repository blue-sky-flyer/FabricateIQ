// Worker URLs
export const CLAUDE_WORKER_URL = 'https://fabricateiq-proxy.raj-lucia001.workers.dev';
export const GEMINI_WORKER_URL = 'https://fabricateiq-gemini.raj-lucia001.workers.dev';

// Auth token for worker requests (client-side — prevents casual abuse, not truly secret)
export const WORKER_AUTH_TOKEN = 'fiq-2024-public-client';

// Default AI model for quote generation
export const DEFAULT_QUOTE_MODEL = 'gemini-3-pro-preview';

// Duration options (days)
export const DURATION_OPTIONS = [1, 3, 7, 30];

// Max PDF text to send to AI (chars)
export const PDF_TEXT_LIMIT = 50_000;

// Catalog pricing reference (Toronto CAD, per sqft / per unit)
export const CATALOG_PRICING = {
  walls: {
    paintedMDF: 68.75,
    oakWood: 103.13,
    complexMillwork: 157.78
  },
  flooring: {
    standardCarpet: 5.50,
    printedVinyl: 14.30,
    gFloorNew: 27.27,
    astroTurf: 16.92
  }
};

// Graphics pricing per sqft of graphics area
export const GRAPHICS_PRICING = {
  modest: 12,
  moderate: 25,
  premium: 45,
  extensive: 60
};

// Service rate multipliers by location
export const SERVICE_RATES = {
  toronto: { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 },
  montreal: { designPM: 0.12, installDismantle: 0.36, logistics: 0.12 },
  usa: { designPM: 0.10, installDismantle: 0.20, logistics: 0.15 }
};
