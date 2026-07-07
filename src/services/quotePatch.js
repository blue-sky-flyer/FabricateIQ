import { normalizeQuote } from '../hooks/useQuote.js';

// Top-level quote sections that a chat edit may replace wholesale. Each is
// swapped as a complete object — no per-line-item reconciliation.
const MERGEABLE_KEYS = ['booth_specs', 'project_type', 'materials', 'services', 'contingency', 'notes'];

// Material categories and their line-item arrays (mirrors excelExport.js).
const MATERIAL_CATS = ['walls', 'flooring', 'graphics', 'av_lighting', 'furniture', 'other'];
// Service categories that sum into the services subtotal.
const SERVICE_CATS = ['design_pm', 'install_dismantle', 'logistics', 'storage'];

function sumExtended(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, li) => sum + (Number(li?.extended) || 0), 0);
}

/**
 * Recompute all derived totals from the ground up so the quote is always
 * internally consistent: category totals from line items, section subtotals
 * from categories, then subtotal -> tax -> total. Fixes model arithmetic drift
 * (e.g. a category total that doesn't match its own line items).
 */
export function recomputeQuoteTotals(quote) {
  if (!quote) return quote;
  const next = normalizeQuote({ ...quote }); // ensures tax_rate is decimal (0.13, not 13)

  let materialsSubtotal = 0;
  if (next.materials && typeof next.materials === 'object') {
    const m = { ...next.materials };
    for (const cat of MATERIAL_CATS) {
      const lineItems = m[`${cat}_line_items`];
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        m[cat] = sumExtended(lineItems); // trust line items over the stated category total
      }
      materialsSubtotal += Number(m[cat]) || 0;
    }
    m.subtotal = materialsSubtotal;
    next.materials = m;
  }

  let servicesSubtotal = 0;
  if (next.services && typeof next.services === 'object') {
    const s = { ...next.services };
    for (const cat of SERVICE_CATS) {
      servicesSubtotal += Number(s[cat]) || 0;
    }
    s.subtotal = servicesSubtotal;
    next.services = s;
  }

  const contingency = Number(next.contingency) || 0;
  const subtotalBeforeTax = materialsSubtotal + servicesSubtotal + contingency;
  const taxRate = Number(next.tax_rate) || 0;
  const taxAmount = Math.round(subtotalBeforeTax * taxRate);

  next.subtotal_before_tax = subtotalBeforeTax;
  next.tax_amount = taxAmount;
  next.total = subtotalBeforeTax + taxAmount;
  return next;
}

/**
 * Apply a section-level patch from the chat worker onto the current quote.
 * Only whole sections present in `patch` are replaced; everything else
 * (including sustainability_enhancements) is preserved. `totals` is treated as
 * a hint — we authoritatively recompute below, but honor a changed tax_rate.
 */
export function applyQuotePatch(current, patch, totals) {
  let next = { ...(current || {}) };

  if (patch && typeof patch === 'object') {
    for (const key of MERGEABLE_KEYS) {
      if (key in patch) next[key] = patch[key];
    }
  }

  // tax_rate isn't a mergeable section but the model may change it (e.g. a
  // location change alters the rate). Take it from totals if provided.
  if (totals && typeof totals.tax_rate === 'number') {
    next.tax_rate = totals.tax_rate;
  }

  return recomputeQuoteTotals(next);
}
