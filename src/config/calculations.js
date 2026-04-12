import { CATALOG_PRICING, GRAPHICS_PRICING, SERVICE_RATES, CITY_COST_MULTIPLIERS } from './constants.js';

// Named multipliers (replacing magic numbers)
const DURATION_MULTIPLIERS = { 1: 1.0, 3: 0.82, 7: 0.60, 30: 0.65 };
const OUTDOOR_MULTIPLIER = 1.15;
const GROUND_MULTIPLIERS = { yes: 1.0, no: 1.20, 'not-sure': 1.08 };
const DEFAULT_WALL_HEIGHT_FT = 10;
const DEFAULT_GRAPHICS_AREA_SQFT = 100;

const TIER_FACTORS = {
  aggressive: {
    materials: 0.85,
    designPM: 0.85,
    installDismantle: 0.80,
    logistics: 0.90,
    contingency: 0
  },
  middle: {
    materials: 1.0,
    designPM: 1.0,
    installDismantle: 1.0,
    logistics: 1.0,
    contingency: 0.05
  },
  conservative: {
    materials: 1.20,
    designPM: 1.15,
    installDismantle: 1.20,
    logistics: 1.15,
    contingency: 0.15
  }
};

/**
 * Calculate booth specs from form dimensions.
 */
export function calculateBoothSpecs(width, length) {
  const w = parseFloat(width) || 0;
  const l = parseFloat(length) || 0;
  const perimeter = (w + l) * 2;

  return {
    wallSqft: perimeter * DEFAULT_WALL_HEIGHT_FT,
    floorSqft: w * l,
    wallType: 'paintedMDF',
    floorType: 'standardCarpet',
    graphics: 'moderate',
    graphicsEstimate: DEFAULT_GRAPHICS_AREA_SQFT
  };
}

/**
 * Calculate materials cost from component specs.
 */
export function calculateMaterials(comps) {
  let cost = 0;
  cost += (comps.wallSqft || 0) * (CATALOG_PRICING.walls[comps.wallType] || CATALOG_PRICING.walls.paintedMDF);

  const floorPrices = CATALOG_PRICING.flooring;
  cost += (comps.floorSqft || 0) * (floorPrices[comps.floorType] || floorPrices.standardCarpet);

  cost += (comps.graphicsEstimate || DEFAULT_GRAPHICS_AREA_SQFT) * (GRAPHICS_PRICING[comps.graphics] || GRAPHICS_PRICING.moderate);

  return cost;
}

/**
 * Calculate tiered estimates (aggressive/middle/conservative).
 * For non-Toronto cities, a city cost multiplier is applied to the materials base to reflect
 * local market pricing (all work assumed to be done by local vendors in the target city).
 */
export function calculateEstimates(comps, location, duration, environment, groundLevel) {
  const cityMultiplier = CITY_COST_MULTIPLIERS[location] ?? 1.0;
  const materials = calculateMaterials(comps) * cityMultiplier;
  const subtotal = materials;

  const rates = SERVICE_RATES[location] || SERVICE_RATES.toronto;
  const durationMult = DURATION_MULTIPLIERS[duration] || 0.95;
  const outdoorMult = environment === 'outdoor' ? OUTDOOR_MULTIPLIER : 1.0;
  const groundMult = GROUND_MULTIPLIERS[groundLevel] || GROUND_MULTIPLIERS['not-sure'];

  const result = {};

  for (const [tier, factors] of Object.entries(TIER_FACTORS)) {
    const costs = {
      materials: materials * factors.materials,
      designPM: subtotal * rates.designPM * factors.designPM * durationMult * outdoorMult,
      installDismantle: subtotal * rates.installDismantle * factors.installDismantle * outdoorMult * groundMult,
      logistics: subtotal * rates.logistics * factors.logistics * durationMult,
      contingency: subtotal * factors.contingency
    };

    result[tier] = {
      ...costs,
      total: Object.values(costs).reduce((sum, val) => sum + val, 0)
    };
  }

  return result;
}
