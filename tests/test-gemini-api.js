#!/usr/bin/env node
/**
 * Automated API Test for Gemini Worker
 *
 * Tests that the Gemini worker correctly extracts booth_specs from PDF-like content
 * and returns accurate quotes within acceptable variance.
 *
 * Usage:
 *   node tests/test-gemini-api.js
 *   node tests/test-gemini-api.js --verbose
 */

const GEMINI_WORKER_URL = 'https://fabricateiq-gemini.raj-lucia001.workers.dev';
const VERBOSE = process.argv.includes('--verbose');

// Test cases with expected booth specs and totals
const TEST_CASES = [
  {
    name: 'Samsung Smart Chalet (Toronto, 20x10)',
    content: `Project: Samsung Smart Chalet
Client: Samsung via Mosaic
Event: Best Buy Chalet Experience
Location: Toronto, ON (24 McGee St)
Booth Size: 20' x 10' (200 sq ft)

LINE ITEMS:
- AGAM frame rental (20'W x 12'H): $3,520.00
- Millwork backwall + cabinets: $25,284.05
- Return wall with 3D window: $8,250.00
- Millwork bar with acrylic letters: $7,812.08
- SEG fabric + vinyl end caps: $1,815.00
- Printed woodgrain floor mat (200 sqft): $2,420.00
- Design/PM: $10,010.00
- Install (4-person crew, 8hr): $5,280.00
- Dismantle (4-person crew, 6hr): $3,080.00
- Freight to/from venue: $2,750.00
- Disposal: $2,200.00

SUBTOTAL: $72,421.13
HST (13%): $9,414.75
TOTAL: $81,835.88`,
    expected: {
      booth_specs: {
        dimensions: '20',  // Should contain 20
        square_footage: 200,
        location: 'Toronto'
      },
      total: 81836,
      variance: 0.15  // Allow 15% variance
    }
  },
  {
    name: 'CCM Hockey (Montreal, 30x50)',
    content: `Project: CCM Hockey - NHL All-Star Fan Experience
Location: Montreal, QC
Booth Size: 30' x 50' (1,500 sq ft)
Event Duration: 3 days (setup day + 2 event days)

LINE ITEMS:
- Custom booth structure (1500 sqft): $85,000.00
- Hockey-themed graphics: $12,000.00
- AV equipment rentals: $15,000.00
- Flooring: $8,500.00
- Furniture: $5,200.00
- Design/PM: $18,000.00
- Install/Dismantle (out-of-town): $35,000.00
- Logistics/Shipping: $22,000.00

SUBTOTAL: $200,700.00
GST+QST (14.975%): $2,258.00 (estimate)
TOTAL: ~$203,000`,
    expected: {
      booth_specs: {
        dimensions: '30',  // Should contain 30
        square_footage: 1500,
        location: 'Montreal'
      },
      total: 203000,
      variance: 0.15
    }
  }
];

async function testGeminiWorker(testCase) {
  const prompt = `Generate a booth quote based PRIMARILY on the LINE ITEMS in this document.

CRITICAL: The line items (individual costs for materials, labor, services) are the PRIMARY source for this quote. Sum them up and categorize them appropriately.

DOCUMENT CONTENT:
${testCase.content}

Instructions:
1. EXTRACT ALL LINE ITEMS from the document - these are your primary pricing data
2. Sum line items into categories
3. Extract booth dimensions and location
4. Apply appropriate tax rate based on location
5. The TOTAL should closely match the sum of line items

Do NOT invent prices - use the actual line item costs from the document.`;

  try {
    const response = await fetch(GEMINI_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'gemini-3-pro-preview'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error || response.status}`);
    }

    const data = await response.json();
    return { success: true, quote: data.quote };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function validateQuote(quote, expected, testName) {
  const results = { passed: true, errors: [] };

  // Check booth_specs exists
  if (!quote.booth_specs) {
    results.errors.push('CRITICAL: booth_specs is missing from response');
    results.passed = false;
  } else {
    // Validate dimensions contains expected value
    if (expected.booth_specs.dimensions &&
        !String(quote.booth_specs.dimensions || '').includes(expected.booth_specs.dimensions) &&
        !String(quote.booth_specs.square_footage || '').toString().includes(expected.booth_specs.square_footage.toString())) {
      results.errors.push(`Dimensions mismatch: got "${quote.booth_specs.dimensions}", expected to contain "${expected.booth_specs.dimensions}"`);
    }

    // Validate location
    if (expected.booth_specs.location &&
        !String(quote.booth_specs.location || '').toLowerCase().includes(expected.booth_specs.location.toLowerCase())) {
      results.errors.push(`Location mismatch: got "${quote.booth_specs.location}", expected "${expected.booth_specs.location}"`);
    }

    // Validate square footage (within 10%)
    if (expected.booth_specs.square_footage) {
      const sqft = quote.booth_specs.square_footage || 0;
      const diff = Math.abs(sqft - expected.booth_specs.square_footage) / expected.booth_specs.square_footage;
      if (diff > 0.1) {
        results.errors.push(`Square footage mismatch: got ${sqft}, expected ~${expected.booth_specs.square_footage}`);
      }
    }
  }

  // Validate total within variance
  if (quote.total) {
    const variance = Math.abs(quote.total - expected.total) / expected.total;
    if (variance > expected.variance) {
      results.errors.push(`Total variance too high: ${(variance * 100).toFixed(1)}% (got $${quote.total.toLocaleString()}, expected ~$${expected.total.toLocaleString()})`);
      results.passed = false;
    }
  } else {
    results.errors.push('Total is missing from response');
    results.passed = false;
  }

  return results;
}

async function runTests() {
  console.log('FabricateIQ Gemini API Test Suite');
  console.log('=' .repeat(50));
  console.log(`Testing: ${GEMINI_WORKER_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    process.stdout.write(`Testing: ${testCase.name}... `);

    const result = await testGeminiWorker(testCase);

    if (!result.success) {
      console.log('FAIL (API Error)');
      console.log(`  Error: ${result.error}\n`);
      failed++;
      continue;
    }

    const validation = validateQuote(result.quote, testCase.expected, testCase.name);

    if (validation.passed && validation.errors.length === 0) {
      console.log('PASS');
      if (VERBOSE) {
        console.log(`  booth_specs: ${JSON.stringify(result.quote.booth_specs)}`);
        console.log(`  total: $${result.quote.total?.toLocaleString()}`);
      }
      passed++;
    } else if (validation.passed) {
      console.log('PASS (with warnings)');
      validation.errors.forEach(e => console.log(`  Warning: ${e}`));
      passed++;
    } else {
      console.log('FAIL');
      validation.errors.forEach(e => console.log(`  Error: ${e}`));
      if (VERBOSE && result.quote) {
        console.log(`  Full response: ${JSON.stringify(result.quote, null, 2)}`);
      }
      failed++;
    }
    console.log('');
  }

  console.log('=' .repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
