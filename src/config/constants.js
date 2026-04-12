// Worker URLs
export const CLAUDE_WORKER_URL = 'https://fabricateiq-proxy.raj-lucia001.workers.dev';
export const GEMINI_WORKER_URL = 'https://fabricateiq-gemini.raj-lucia001.workers.dev';
export const VENDOR_WORKER_URL = 'https://fabricateiq-vendors.raj-lucia001.workers.dev';

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
// I&D rates derived from 2022 Exhibitor Advocacy Rate Survey; multipliers vs Toronto baseline (0.14)
export const SERVICE_RATES = {
  // Canada
  toronto:       { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 },
  montreal:      { designPM: 0.12, installDismantle: 0.36, logistics: 0.12 },
  vancouver:     { designPM: 0.10, installDismantle: 0.18, logistics: 0.08 }, // 1.30× union (BC Building Trades)
  // USA — Northeast (heavily unionized)
  new_york:      { designPM: 0.10, installDismantle: 0.36, logistics: 0.18 }, // 2.55× Teamsters/Carpenters/IBEW
  boston:        { designPM: 0.10, installDismantle: 0.31, logistics: 0.17 }, // 2.20× Carpenters/IATSE
  philadelphia:  { designPM: 0.10, installDismantle: 0.34, logistics: 0.18 }, // 2.40× highest material handling
  // USA — Midwest
  chicago:       { designPM: 0.10, installDismantle: 0.28, logistics: 0.17 }, // 2.00× McCormick Place unions
  kansas_city:   { designPM: 0.10, installDismantle: 0.16, logistics: 0.16 }, // 1.15× mixed market
  // USA — South (open shop)
  dallas:        { designPM: 0.10, installDismantle: 0.14, logistics: 0.15 }, // 0.97× open shop
  houston:       { designPM: 0.10, installDismantle: 0.14, logistics: 0.15 }, // 1.03× open shop
  austin:        { designPM: 0.10, installDismantle: 0.15, logistics: 0.15 }, // 1.10× open shop
  miami:         { designPM: 0.10, installDismantle: 0.24, logistics: 0.16 }, // 1.70× Local 1175 Decorators
  atlanta:       { designPM: 0.10, installDismantle: 0.13, logistics: 0.15 }, // 0.90× open shop GWCC — lowest cost US market
  // USA — West (heavily unionized, CA prevailing wage)
  los_angeles:   { designPM: 0.10, installDismantle: 0.33, logistics: 0.18 }, // 2.35× IATSE Local 831
  seattle:       { designPM: 0.10, installDismantle: 0.25, logistics: 0.17 }, // 1.80× Carpenters/IBEW/IATSE
  san_francisco: { designPM: 0.10, installDismantle: 0.36, logistics: 0.19 }, // 2.60× CA prevailing wage + Bay Area premium
  // Generic fallback
  usa:           { designPM: 0.10, installDismantle: 0.20, logistics: 0.15 },
};

// Locations that bill in USD (all non-Canadian cities)
export const US_LOCATIONS = new Set([
  'usa', 'new_york', 'los_angeles', 'dallas', 'houston', 'austin',
  'boston', 'chicago', 'miami', 'atlanta', 'seattle', 'philadelphia',
  'kansas_city', 'san_francisco'
]);
