import {
  CLAUDE_WORKER_URL,
  GEMINI_WORKER_URL,
  WORKER_AUTH_TOKEN,
  DEFAULT_QUOTE_MODEL,
  PDF_TEXT_LIMIT
} from '../config/constants.js';

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
  return authenticatedFetch(GEMINI_WORKER_URL, {
    mode: 'chat',
    currentQuote,
    message,
    conversationHistory: conversationHistory.slice(-10),
    model: DEFAULT_QUOTE_MODEL
  });
}

/**
 * Build the quote prompt from form values or PDF text.
 * Returns { promptText, wasTruncated }.
 */
export function buildQuotePrompt({ pdfText, width, length, location, indoor, duration, groundLevel, getCurrency }) {
  if (pdfText) {
    const truncatedText = pdfText.length > PDF_TEXT_LIMIT
      ? pdfText.substring(0, PDF_TEXT_LIMIT)
      : pdfText;
    const wasTruncated = pdfText.length > PDF_TEXT_LIMIT;

    const promptText = `Generate a booth quote based PRIMARILY on the LINE ITEMS in this PDF document.

CRITICAL: The line items (individual costs for materials, labor, services) in the PDF are the PRIMARY source for this quote. Sum them up and categorize them appropriately.

PDF CONTENT:
${truncatedText}

Instructions:
1. EXTRACT ALL LINE ITEMS from the PDF - these are your primary pricing data
2. Sum line items into categories:
   - Materials: walls/fabrication, flooring, graphics, AV/lighting, furniture, rentals
   - Services: design/PM, install/dismantle, labor, logistics/shipping/drayage
3. Extract booth dimensions and location if mentioned
4. Apply appropriate tax rate based on location (13% Ontario HST, 14.975% Quebec GST+QST)
5. The TOTAL should closely match the sum of line items from the PDF (plus tax if not included)

Do NOT invent prices - use the actual line item costs from the PDF.
Use the calibrated service ratios from SKILL.md only if specific service costs are not itemized in the PDF.`;

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

Provide a complete quote with materials breakdown, services (design/PM, install/dismantle, logistics), tax, and total. Use the calibrated service ratios from the SKILL.md for this project type.`;

  return { promptText, wasTruncated: false };
}
