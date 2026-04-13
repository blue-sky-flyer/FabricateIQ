// Worker URLs
export const CLAUDE_WORKER_URL = 'https://fabricateiq-proxy.raj-lucia001.workers.dev';
export const GEMINI_WORKER_URL = 'https://fabricateiq-gemini.sp9n.workers.dev';
export const VENDOR_WORKER_URL = 'https://fabricateiq-vendors.sp9n.workers.dev';

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
// These are LOCAL vendor service ratios (Design/PM and I&D as % of fabrication subtotal).
// Quotes assume all work is executed by local vendors in the target city — PTNR has no role
// outside Toronto. The overall cost difference is captured in CITY_COST_MULTIPLIERS below.
export const SERVICE_RATES = {
  // Canada
  toronto:       { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 },
  montreal:      { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 }, // local QC vendors
  vancouver:     { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 }, // local BC vendors
  // USA — Northeast (slight union premium on I&D ratio)
  new_york:      { designPM: 0.10, installDismantle: 0.16, logistics: 0.05 },
  boston:        { designPM: 0.10, installDismantle: 0.16, logistics: 0.05 },
  philadelphia:  { designPM: 0.10, installDismantle: 0.16, logistics: 0.05 },
  // USA — Midwest
  chicago:       { designPM: 0.10, installDismantle: 0.15, logistics: 0.05 },
  kansas_city:   { designPM: 0.09, installDismantle: 0.14, logistics: 0.04 },
  // USA — South (open shop, lean service ratios)
  dallas:        { designPM: 0.09, installDismantle: 0.13, logistics: 0.04 },
  houston:       { designPM: 0.09, installDismantle: 0.13, logistics: 0.04 },
  austin:        { designPM: 0.09, installDismantle: 0.13, logistics: 0.04 },
  miami:         { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 },
  atlanta:       { designPM: 0.09, installDismantle: 0.13, logistics: 0.04 },
  // USA — West (union premium on I&D ratio)
  los_angeles:   { designPM: 0.10, installDismantle: 0.16, logistics: 0.05 },
  seattle:       { designPM: 0.10, installDismantle: 0.15, logistics: 0.05 },
  san_francisco: { designPM: 0.10, installDismantle: 0.16, logistics: 0.05 },
  // Generic fallback
  usa:           { designPM: 0.09, installDismantle: 0.14, logistics: 0.05 },
};

// Whole-project cost multipliers vs Toronto baseline (1.0).
// Applied to materials (fabrication, flooring, graphics) to reflect local market pricing.
// Covers differences in labor costs, real estate, material sourcing, and market demand.
// Source: industry cost-of-market indices + 2022 Exhibitor Advocacy Survey. Updated: 2026-04-12.
export const CITY_COST_MULTIPLIERS = {
  toronto:       1.00,
  montreal:      0.95, // QC market slightly cheaper on fabrication
  vancouver:     1.20, // BC union wages, Pacific port import costs
  new_york:      1.75, // highest-cost market; union labor + NYC real estate overhead
  boston:        1.55, // Northeast union premium
  philadelphia:  1.50, // union market; slightly lower than NYC
  chicago:       1.45, // McCormick Place union; Midwest logistics hub
  kansas_city:   0.90, // central US; mixed market; lower labor costs
  dallas:        0.85, // open shop; no state income tax; lower real estate
  houston:       0.85, // open shop; similar to Dallas
  austin:        0.90, // open shop but tech-boom premium; higher than Dallas
  miami:         1.10, // tourism/event demand premium; mixed union
  atlanta:       0.80, // lowest-cost major US market; open shop GWCC
  los_angeles:   1.65, // CA prevailing wage + high real estate
  seattle:       1.35, // Pacific Northwest union wages; lower than CA
  san_francisco: 1.90, // highest overall; CA prevailing wage + Bay Area premium
  usa:           1.30, // generic US average fallback
};

// Locations that bill in USD (all non-Canadian cities)
export const US_LOCATIONS = new Set([
  'usa', 'new_york', 'los_angeles', 'dallas', 'houston', 'austin',
  'boston', 'chicago', 'miami', 'atlanta', 'seattle', 'philadelphia',
  'kansas_city', 'san_francisco'
]);
