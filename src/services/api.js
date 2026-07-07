import {
  CLAUDE_WORKER_URL,
  GEMINI_WORKER_URL,
  VENDOR_WORKER_URL,
  WORKER_AUTH_TOKEN,
  DEFAULT_QUOTE_MODEL,
  PDF_TEXT_LIMIT
} from '../config/constants.js';
import { logError } from './logger.js';

/**
 * Shared fetch wrapper that includes auth header.
 */
async function authenticatedFetch(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WORKER_AUTH_TOKEN}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Analyze booth image/PDF with Claude Vision.
 */
export async function analyzeWithClaude(imageBase64, pdfTextContent, imageMediaType) {
  const jsonSchema = '{wallSqft: number, floorSqft: number, wallType: "paintedMDF"|"oakWood"|"complexMillwork", floorType: "standardCarpet"|"printedVinyl"|"gFloorNew"|"astroTurf", graphics: "modest"|"moderate"|"premium"|"extensive", graphicsEstimate: number}';

  const messageContent = [];

  if (imageBase64) {
    messageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: imageMediaType, data: imageBase64 }
    });
  }

  let promptText = '';
  if (pdfTextContent && imageBase64) {
    promptText = `Analyze this booth rendering image along with the PDF parts list below. Extract component details.\n\nPDF Content:\n${pdfTextContent}\n\nReturn ONLY valid JSON: ${jsonSchema}. No markdown, no explanation.`;
  } else if (pdfTextContent) {
    promptText = `Extract booth component details from this parts list PDF text.\n\nPDF Content:\n${pdfTextContent}\n\nReturn ONLY valid JSON: ${jsonSchema}. No markdown, no explanation.`;
  } else if (imageBase64) {
    promptText = `Analyze this booth rendering image. Estimate wall square footage, floor area, materials used, and graphics complexity. Return ONLY valid JSON: ${jsonSchema}. No markdown, no explanation.`;
  }

  messageContent.push({ type: 'text', text: promptText });

  const data = await authenticatedFetch(CLAUDE_WORKER_URL, {
    messages: [{ role: 'user', content: messageContent }]
  });

  if (data.error) throw new Error(data.error);
  if (data.type === 'error') throw new Error(data.error?.message || 'Claude API error');

  if (!data.content?.[0]?.text) {
    throw new Error('Invalid response from Claude');
  }

  let jsonText = data.content[0].text.trim();
  if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
  else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
  if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);

  return JSON.parse(jsonText.trim());
}

/**
 * Generate a structured AI quote from Gemini.
 * Returns { quote, model, usage }.
 */
export async function fetchAIQuote(promptText) {
  return authenticatedFetch(GEMINI_WORKER_URL, {
    messages: [{ role: 'user', content: promptText }],
    model: DEFAULT_QUOTE_MODEL
  });
}

/**
 * Send a chat adjustment to Gemini.
 * Returns { updatedQuote, response, whatIf, changesSummary, model, usage }.
 */
export async function fetchChatResponse(currentQuote, message, conversationHistory) {
  // sustainability_enhancements is large and not needed for edits — strip it
  // before sending. It's preserved client-side and re-attached after merge.
  const { sustainability_enhancements, sustainability_summary, ...leanQuote } = currentQuote || {};
  return authenticatedFetch(GEMINI_WORKER_URL, {
    mode: 'chat',
    currentQuote: leanQuote,
    message,
    conversationHistory: conversationHistory.slice(-10),
    model: DEFAULT_QUOTE_MODEL
  });
}

/**
 * Build the quote prompt from form values or PDF text.
 * Returns { promptText, wasTruncated }.
 */
export function buildQuotePrompt({ pdfText, description, width, length, location, indoor, duration, groundLevel, getCurrency }) {
  const descriptionBlock = description
    ? `\n\nUSER CONTEXT:\nThe user provided the following description of these files: ${description}`
    : '';

  if (pdfText) {
    const truncatedText = pdfText.length > PDF_TEXT_LIMIT
      ? pdfText.substring(0, PDF_TEXT_LIMIT)
      : pdfText;
    const wasTruncated = pdfText.length > PDF_TEXT_LIMIT;

    const promptText = `Generate a booth quote based PRIMARILY on the LINE ITEMS in this PDF document.

CRITICAL: The line items (individual costs for materials, labor, services) in the PDF are the PRIMARY source for this quote. Sum them up and categorize them appropriately.

LOCATION OVERRIDE: The user has selected "${location}" as the project location. This overrides any location mentioned in the PDF (e.g. ignore any Toronto/PTNR references in the document). Apply the correct city cost multiplier, local service ratios, and tax rate for ${location} as defined in SKILL.md.

PDF CONTENT:
${truncatedText}

Instructions:
1. EXTRACT ALL LINE ITEMS from the PDF - these are your primary pricing data
2. Sum line items into categories:
   - Materials: walls/fabrication, flooring, graphics, AV/lighting, furniture, rentals
   - Services: design/PM, install/dismantle, labor, logistics/shipping/drayage
3. Use the user-selected location (${location}) — do NOT infer location from the PDF content
4. Apply the correct tax rate for ${location} as defined in SKILL.md
5. The TOTAL should closely match the sum of line items from the PDF (plus tax if not included)

Do NOT invent prices - use the actual line item costs from the PDF.
Use the calibrated service ratios from SKILL.md only if specific service costs are not itemized in the PDF.${descriptionBlock}`;

    return { promptText, wasTruncated };
  }

  const w = parseFloat(width) || 10;
  const l = parseFloat(length) || 10;
  const currency = getCurrency();
  const env = indoor ? 'indoor' : 'outdoor';
  const ground = groundLevel === 'yes' ? 'Yes (level floor)' : groundLevel === 'no' ? 'No (uneven, requires leveling)' : 'Unknown';

  const promptText = `Generate a detailed booth quote for:
- Dimensions: ${w}ft x ${l}ft (${w * l} sq ft)
- Location: ${location}
- Currency: ${currency}
- Environment: ${env}
- Duration: ${duration} days
- Ground Level: ${ground}

Provide a complete quote with materials breakdown, services (design/PM, install/dismantle, logistics), tax, and total. Use the calibrated service ratios from the SKILL.md for this project type.${descriptionBlock}`;

  return { promptText, wasTruncated: false };
}

/**
 * Fetch vendor recommendations for a given location from the vendor Worker.
 * Returns vendor data object or null if unavailable.
 */
export async function fetchVendors(location) {
  try {
    const response = await fetch(`${VENDOR_WORKER_URL}/vendors?city=${encodeURIComponent(location)}`, {
      headers: { 'Authorization': `Bearer ${WORKER_AUTH_TOKEN}` }
    });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    // Vendors are optional (graceful degradation) — log but don't surface.
    logError('vendors.fetch', err, { location });
    return null;
  }
}
