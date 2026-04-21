// Cloudflare Worker - FabricateIQ Gemini proxy (fabricateiq-gemini)
// Routes Gemini API calls through secure proxy with SKILL.md system prompt

import {
  getCorsHeaders,
  handleCorsPreflightIfNeeded,
  authenticateRequest,
  validateBodySize,
  sanitizeError,
  fetchWithTimeout,
  cleanJsonFromAI,
  validateMessages,
  validateModel,
  checkRateLimit
} from './middleware.js';

const SKILL_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/skills/quote-generator/SKILL.md';
const CATALOG_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/MASTER_CATALOG.md';
const SUSTAINABILITY_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/public/SUSTAINABILITY_GUIDE.md';

// Line item schema used within materials and services
const LINE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    item: { type: "string", description: "Line item description" },
    qty: { type: "number", description: "Quantity" },
    dimensions: { type: "string", description: "Dimensions (e.g., \"8'x8'\" or \"200 sqft\")" },
    unit_price: { type: "string", description: "Unit price with unit (e.g., \"$68.75/sqft\" or \"$4,400 each\")" },
    extended: { type: "number", description: "Extended price (qty x unit price)" },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "Pricing confidence" }
  },
  required: ["item", "extended"]
};

// Structured output schema for booth quotes
const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    booth_specs: {
      type: "object",
      properties: {
        dimensions: { type: "string", description: "Booth dimensions (e.g., '20ft x 30ft')" },
        square_footage: { type: "number", description: "Total square footage" },
        location: { type: "string", description: "Event location/city" },
        event_name: { type: "string", description: "Event or show name if mentioned" },
        duration_days: { type: "number", description: "Event duration in days" }
      },
      description: "Booth specifications extracted from quote/PDF"
    },
    project_type: {
      type: "string",
      enum: ["toronto_standard", "toronto_festival", "outoftown", "fabrication_only"],
      description: "Detected project profile: 'toronto_standard'=PTNR Toronto work use MASTER_CATALOG rates; 'toronto_festival'=Toronto non-standard hours; 'outoftown'=ALL non-Toronto cities local vendors execute full project apply city cost multiplier + local service ratios; 'fabrication_only'=props/fabrication only 0% services"
    },
    materials: {
      type: "object",
      properties: {
        walls: { type: "number", description: "Wall fabrication cost" },
        walls_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        flooring: { type: "number", description: "Flooring cost" },
        flooring_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        graphics: { type: "number", description: "Graphics/signage cost" },
        graphics_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        av_lighting: { type: "number", description: "AV and lighting cost" },
        av_lighting_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        furniture: { type: "number", description: "Furniture cost" },
        furniture_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        other: { type: "number", description: "Other materials" },
        other_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        subtotal: { type: "number", description: "Materials subtotal" }
      },
      required: ["subtotal"]
    },
    services: {
      type: "object",
      properties: {
        design_pm: { type: "number", description: "Design and project management" },
        design_pm_percent: { type: "number", description: "Design/PM as % of fabrication subtotal" },
        design_pm_note: { type: "string", description: "Basis for design/PM calculation" },
        install_dismantle: { type: "number", description: "Installation and dismantling labor" },
        install_dismantle_percent: { type: "number", description: "I&D as % of fabrication subtotal" },
        install_dismantle_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        logistics: { type: "number", description: "Shipping and drayage" },
        logistics_percent: { type: "number", description: "Logistics as % of fabrication subtotal" },
        logistics_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        storage: { type: "number", description: "Storage costs if applicable" },
        storage_line_items: { type: "array", items: LINE_ITEM_SCHEMA },
        subtotal: { type: "number", description: "Services subtotal" }
      },
      required: ["subtotal"]
    },
    contingency: { type: "number", description: "Contingency amount (5-10%)" },
    subtotal_before_tax: { type: "number", description: "Subtotal before tax" },
    tax_rate: { type: "number", description: "Tax rate (e.g., 0.13 for HST, 0.14975 for QST+GST)" },
    tax_amount: { type: "number", description: "Calculated tax amount" },
    total: { type: "number", description: "Final total including tax" },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence level in the estimate"
    },
    notes: {
      type: "array",
      items: { type: "string" },
      description: "Important notes, assumptions, or caveats"
    },
    sustainability_enhancements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["walls", "flooring", "graphics", "furniture", "av_lighting", "other", "operations"], description: "Material category" },
          original_item: { type: "string", description: "Current material/item from the quote" },
          original_cost: { type: "number", description: "Current cost from the quote" },
          suggested_item: { type: "string", description: "Sustainable alternative" },
          suggested_cost: { type: "number", description: "Estimated cost of sustainable alternative" },
          cost_delta: { type: "number", description: "Cost difference (positive = more expensive, negative = savings)" },
          cost_delta_percent: { type: "number", description: "Percentage change from original" },
          environmental_impact: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"], description: "Environmental benefit level" },
          notes: { type: "string", description: "Why this is better and any trade-offs" },
          confidence: { type: "string", enum: ["high", "medium", "low"], description: "Pricing confidence" }
        },
        required: ["category", "original_item", "original_cost", "suggested_item", "suggested_cost", "cost_delta", "environmental_impact"]
      },
      description: "Sustainable material alternatives with estimated cost impact"
    },
    sustainability_summary: {
      type: "object",
      properties: {
        total_original: { type: "number", description: "Sum of original costs for items with alternatives" },
        total_suggested: { type: "number", description: "Sum of suggested sustainable costs" },
        net_cost_delta: { type: "number", description: "Net cost difference" },
        net_cost_delta_percent: { type: "number", description: "Net percentage change" },
        top_impact_items: { type: "array", items: { type: "string" }, description: "Most impactful sustainability changes" }
      },
      description: "Summary of sustainability cost impact"
    }
  },
  required: ["project_type", "materials", "services", "subtotal_before_tax", "tax_rate", "tax_amount", "total", "confidence"]
};

/**
 * Handle chat mode: adjust an existing quote via conversation.
 */
async function handleChatMode(body, systemInstruction, env) {
  const model = validateModel(body.model);
  const isGemini3 = model.startsWith('gemini-3');
  const { currentQuote, message, conversationHistory } = body;

  if (!currentQuote || typeof message !== 'string' || !message.trim()) {
    throw new Error('Chat mode requires currentQuote and a non-empty message');
  }

  const chatSystemPrompt = `${systemInstruction}

---

# CHAT ADJUSTMENT MODE

You are adjusting an existing booth quote through conversation. The user's current quote JSON is provided below. Follow the "Chat Adjustment Mode" rules from SKILL.md above.

RESPONSE FORMAT: Return ONLY a valid JSON object with these fields:
{
  "updatedQuote": { /* the COMPLETE quote JSON with changes applied */ },
  "response": "Natural language explanation of what changed and cost impact",
  "whatIf": false,
  "changesSummary": "Short label for version history"
}

RULES:
- updatedQuote must contain the FULL quote (all fields), not just changed fields
- Preserve all unchanged line items exactly as-is
- Recalculate cascading totals: materials subtotal -> services -> contingency -> tax -> total
- If the user is asking a "what if" or exploratory question, set whatIf: true
- Use whole numbers for dollar amounts
- No markdown, no explanation outside the JSON`;

  // Build conversation messages for Gemini
  const geminiMessages = [
    {
      role: 'user',
      parts: [{ text: `Here is the current quote JSON:\n\n${JSON.stringify(currentQuote, null, 2)}` }]
    },
    {
      role: 'model',
      parts: [{ text: 'I have the current quote. What adjustments would you like to make?' }]
    }
  ];

  // Add conversation history (last 10 exchanges)
  if (conversationHistory && Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory.slice(-10)) {
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  geminiMessages.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const geminiRequest = {
    contents: geminiMessages,
    systemInstruction: { parts: [{ text: chatSystemPrompt }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      ...(model.startsWith('gemini-3') && { thinkingConfig: { thinkingLevel: 'LOW' } })
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error (chat): ${response.status} - ${errorText}`);
    throw new Error('AI service temporarily unavailable');
  }

  const geminiResponse = await response.json();
  const textContent = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('No content in Gemini response');
  }

  let chatResult;
  try {
    chatResult = cleanJsonFromAI(textContent);
  } catch {
    chatResult = {
      updatedQuote: null,
      response: textContent,
      whatIf: false,
      changesSummary: null,
      error: 'Could not parse quote update from AI response'
    };
  }

  return {
    updatedQuote: chatResult.updatedQuote || null,
    response: chatResult.response || 'I processed your request but could not generate a response.',
    whatIf: chatResult.whatIf || false,
    changesSummary: chatResult.changesSummary || null,
    model,
    usage: geminiResponse.usageMetadata
  };
}

/**
 * Handle quote mode: generate a new quote.
 */
async function handleQuoteMode(body, systemInstruction, env) {
  const model = validateModel(body.model);
  const isGemini3 = model.startsWith('gemini-3');

  const msgError = validateMessages(body.messages);
  if (msgError) {
    throw new Error(msgError);
  }

  let messages = body.messages;
  {
    const lastMsgIndex = messages.length - 1;
    const jsonInstructions = `\n\nIMPORTANT: Return ONLY a valid JSON object with these exact fields:
{
  "booth_specs": {"dimensions": "20ft x 30ft", "square_footage": 600, "location": "New York", "event_name": "Trade Show", "duration_days": 3},
  "project_type": "outoftown",
  "materials": {
    "walls": 0, "walls_line_items": [{"item": "Back Wall Painted MDF", "qty": 1, "dimensions": "20x8ft", "unit_price": "$68.75/sqft", "extended": 11000, "confidence": "high"}],
    "flooring": 0, "flooring_line_items": [{"item": "Standard Carpet", "qty": 600, "dimensions": "600 sqft", "unit_price": "$5.50/sqft", "extended": 3300, "confidence": "high"}],
    "graphics": 0, "graphics_line_items": [{"item": "SEG Fabric Graphic", "qty": 1, "dimensions": "20x8ft", "unit_price": "$34/sqft", "extended": 5440, "confidence": "high"}],
    "av_lighting": 0, "av_lighting_line_items": [{"item": "LED Monitor 55in", "qty": 2, "dimensions": "n/a", "unit_price": "$800 each", "extended": 1600, "confidence": "medium"}],
    "furniture": 0, "furniture_line_items": [{"item": "Custom Counter", "qty": 1, "dimensions": "4x4ft", "unit_price": "$4400 each", "extended": 4400, "confidence": "high"}],
    "other": 0, "other_line_items": [{"item": "Miscellaneous", "qty": 1, "dimensions": "n/a", "unit_price": "$500", "extended": 500, "confidence": "low"}],
    "subtotal": 0
  },
  "services": {
    "design_pm": 0, "design_pm_percent": 0.10, "design_pm_note": "10% of fabrication subtotal",
    "install_dismantle": 0, "install_dismantle_percent": 0.15, "install_dismantle_line_items": [{"item": "I&D Labor", "qty": 4, "dimensions": "2 days", "unit_price": "$850/day", "extended": 6800, "confidence": "medium"}],
    "logistics": 0, "logistics_percent": 0.05, "logistics_line_items": [{"item": "Local Delivery", "qty": 1, "dimensions": "n/a", "unit_price": "$1200", "extended": 1200, "confidence": "medium"}],
    "storage": 0, "storage_line_items": [{"item": "Pre-show storage", "qty": 2, "dimensions": "skids", "unit_price": "$275/skid/month", "extended": 550, "confidence": "medium"}],
    "subtotal": 0
  },
  "contingency": 0,
  "subtotal_before_tax": 0,
  "tax_rate": 0.08875,
  "tax_amount": 0,
  "total": 0,
  "confidence": "medium",
  "notes": ["Pricing based on New York local market rates at 1.75x Toronto baseline.", "All work executed by local vendors in New York. No cross-border shipping from Toronto.", "Tax rate: 8.875% NYC combined sales tax applied."],
  "sustainability_enhancements": [{"category": "flooring", "original_item": "Standard Carpet", "original_cost": 3300, "suggested_item": "Recycled Content Carpet Tile", "suggested_cost": 3800, "cost_delta": 500, "cost_delta_percent": 15.2, "environmental_impact": "MEDIUM", "notes": "Recycled content tiles are reusable and divertible from landfill", "confidence": "medium"}],
  "sustainability_summary": {"total_original": 3300, "total_suggested": 3800, "net_cost_delta": 500, "net_cost_delta_percent": 15.2, "top_impact_items": ["Switch flooring to recycled content tiles"]}
}
CRITICAL RULES:
1. Extract booth_specs from the PDF content - dimensions, square footage, location, event name.
2. EVERY category with a non-zero dollar amount MUST have line_items showing what makes up that number.
3. For walls: itemize each wall section.
4. For services: show percentage basis and calculation.
5. For I&D: show crew count, hours/days, and implied rate if calculable.
6. Use whole numbers for dollar amounts. No markdown, no explanation, just the JSON.
7. Include sustainability_enhancements: for each material line item, suggest a greener alternative with estimated cost delta using the SUSTAINABILITY GUIDE and MASTER_CATALOG pricing. Skip items with no viable alternative.
8. Include sustainability_summary with totals and top_impact_items describing the most impactful changes.
9. BILLING MODEL — NON-TORONTO CITIES: When location is outside Toronto, a LOCAL vendor in that city executes the full project. There is NO cross-border shipping from Toronto, NO out-of-town travel or per diem, and NO export tax treatment. Apply the city cost multiplier to materials, use local service ratios (Design/PM 9-11%, I&D 13-17%, Logistics 4-5%), and apply the correct local tax rate (e.g. NYC = 8.875%, LA/SF = 10.25%, Dallas = 8.25%, Chicago = 10.25%, Atlanta = 8.9%, Seattle = 10.35%). The notes array MUST state: (a) the city multiplier vs Toronto baseline, (b) that all work is executed by local vendors with no cross-border shipping, (c) the correct local tax rate. NEVER write notes about out-of-town travel, cross-border logistics, or 0% export tax for any non-Toronto location.`;
    messages = messages.map((msg, i) =>
      i === lastMsgIndex ? { ...msg, content: msg.content + jsonInstructions } : msg
    );
  }

  const geminiRequest = {
    contents: messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      ...(!isGemini3 && { responseMimeType: 'application/json' }),
      temperature: 0.1,
      maxOutputTokens: 6144,
      ...(model.startsWith('gemini-3') && { thinkingConfig: { thinkingLevel: 'LOW' } })
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error (quote): ${response.status} - ${errorText}`);
    throw new Error('AI service temporarily unavailable');
  }

  const geminiResponse = await response.json();
  const textContent = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('No content in Gemini response');
  }

  const quote = cleanJsonFromAI(textContent);

  return { quote, model, usage: geminiResponse.usageMetadata };
}

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
      // Fetch SKILL.md, MASTER_CATALOG, and SUSTAINABILITY_GUIDE at runtime (with timeout)
      // Use 10s timeout and treat GitHub fetch failures as non-fatal where possible
      const [skillRes, catalogRes, sustainRes] = await Promise.all([
        fetchWithTimeout(SKILL_URL, {}, 10000).catch(() => ({ ok: false })),
        fetchWithTimeout(CATALOG_URL, {}, 10000).catch(() => ({ ok: false })),
        fetchWithTimeout(SUSTAINABILITY_URL, {}, 10000).catch(() => ({ ok: false }))
      ]);

      if (!skillRes.ok || !catalogRes.ok) {
        throw new Error('Failed to fetch skill or catalog from GitHub — please retry');
      }

      const skillContent = await skillRes.text();
      const catalogContent = await catalogRes.text();
      const sustainContent = sustainRes?.ok ? await sustainRes.text() : '';
      const systemInstruction = `${skillContent}\n\n---\n\n# REFERENCE DATA\n${catalogContent}${sustainContent ? `\n\n---\n\n# SUSTAINABILITY GUIDE\n${sustainContent}` : ''}`;

      const body = await request.json();

      // Validate mode
      if (body.mode && body.mode !== 'chat') {
        return new Response(JSON.stringify({ error: 'Invalid mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = body.mode === 'chat'
        ? await handleChatMode(body, systemInstruction, env)
        : await handleQuoteMode(body, systemInstruction, env);

      return new Response(JSON.stringify(result), {
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
