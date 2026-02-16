// Cloudflare Worker - FabricateIQ Gemini proxy (deployed as boothiq-gemini)
// Routes Gemini API calls through secure proxy with SKILL.md system prompt

const SKILL_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/skills/quote-generator/SKILL.md';
const CATALOG_URL = 'https://raw.githubusercontent.com/blue-sky-flyer/FabricateIQ/main/MASTER_CATALOG.md';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Line item schema used within materials and services
const LINE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    item: { type: "string", description: "Line item description" },
    qty: { type: "number", description: "Quantity" },
    dimensions: { type: "string", description: "Dimensions (e.g., \"8'x8'\" or \"200 sqft\")" },
    unit_price: { type: "string", description: "Unit price with unit (e.g., \"$68.75/sqft\" or \"$4,400 each\")" },
    extended: { type: "number", description: "Extended price (qty × unit price)" },
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
      description: "Detected project profile"
    },
    materials: {
      type: "object",
      properties: {
        walls: { type: "number", description: "Wall fabrication cost" },
        walls_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized wall/structure costs" },
        flooring: { type: "number", description: "Flooring cost" },
        flooring_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized flooring costs" },
        graphics: { type: "number", description: "Graphics/signage cost" },
        graphics_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized graphics/signage costs" },
        av_lighting: { type: "number", description: "AV and lighting cost" },
        av_lighting_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized AV/lighting costs" },
        furniture: { type: "number", description: "Furniture cost" },
        furniture_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized furniture costs" },
        other: { type: "number", description: "Other materials" },
        other_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Other itemized costs" },
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
        install_dismantle_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized I&D costs (crew, days, rates)" },
        logistics: { type: "number", description: "Shipping and drayage" },
        logistics_percent: { type: "number", description: "Logistics as % of fabrication subtotal" },
        logistics_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized logistics costs" },
        storage: { type: "number", description: "Storage costs if applicable" },
        storage_line_items: { type: "array", items: LINE_ITEM_SCHEMA, description: "Itemized storage costs" },
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
    }
  },
  required: ["project_type", "materials", "services", "subtotal_before_tax", "tax_rate", "tax_amount", "total", "confidence"]
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Fetch SKILL.md and MASTER_CATALOG at runtime
      const [skillRes, catalogRes] = await Promise.all([
        fetch(SKILL_URL),
        fetch(CATALOG_URL)
      ]);

      if (!skillRes.ok || !catalogRes.ok) {
        throw new Error('Failed to fetch skill or catalog from GitHub');
      }

      const skillContent = await skillRes.text();
      const catalogContent = await catalogRes.text();

      const systemInstruction = `${skillContent}\n\n---\n\n# REFERENCE DATA\n${catalogContent}`;

      const body = await request.json();

      // ── CHAT MODE: Adjust an existing quote via conversation ──
      if (body.mode === 'chat') {
        const model = body.model || 'gemini-2.5-flash';
        const isGemini3 = model.startsWith('gemini-3');
        const { currentQuote, message, conversationHistory } = body;

        // Build chat-specific system prompt
        const chatSystemPrompt = `${systemInstruction}

---

# CHAT ADJUSTMENT MODE

You are adjusting an existing booth quote through conversation. The user's current quote JSON is provided below. Follow the "Chat Adjustment Mode" rules from SKILL.md above.

RESPONSE FORMAT: Return ONLY a valid JSON object with these fields:
{
  "updatedQuote": { /* the COMPLETE quote JSON with changes applied — same schema as the original */ },
  "response": "Natural language explanation of what changed and cost impact",
  "whatIf": false,
  "changesSummary": "Short label for version history (e.g., 'Swapped G-Floor for Printed Vinyl')"
}

RULES:
- updatedQuote must contain the FULL quote (all fields), not just changed fields
- Preserve all unchanged line items exactly as-is
- Recalculate cascading totals: materials subtotal → services (percentage-based) → contingency → tax → total
- If the user is asking a "what if" or exploratory question, set whatIf: true
- Use whole numbers for dollar amounts
- No markdown, no explanation outside the JSON — put your explanation in the "response" field`;

        // Build conversation messages for Gemini
        const geminiMessages = [];

        // First message: provide the current quote context
        geminiMessages.push({
          role: 'user',
          parts: [{ text: `Here is the current quote JSON:\n\n${JSON.stringify(currentQuote, null, 2)}` }]
        });
        geminiMessages.push({
          role: 'model',
          parts: [{ text: 'I have the current quote. What adjustments would you like to make?' }]
        });

        // Add conversation history (last 10 exchanges)
        if (conversationHistory && conversationHistory.length > 0) {
          for (const msg of conversationHistory.slice(-10)) {
            geminiMessages.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            });
          }
        }

        // Add the current user message
        geminiMessages.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const geminiRequest = {
          contents: geminiMessages,
          systemInstruction: {
            parts: [{ text: chatSystemPrompt }]
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            ...(isGemini3 && { thinkingConfig: { thinkingLevel: 'LOW' } })
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
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const geminiResponse = await response.json();
        const textContent = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
          throw new Error('No content in Gemini response');
        }

        // Try to parse the chat response JSON
        let chatResult;
        try {
          let cleanedText = textContent.trim();
          if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
          else if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
          if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
          cleanedText = cleanedText.trim();

          const jsonStart = cleanedText.indexOf('{');
          const jsonEnd = cleanedText.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedText = cleanedText.slice(jsonStart, jsonEnd + 1);
          }

          chatResult = JSON.parse(cleanedText);
        } catch (parseError) {
          // JSON parse failed — return the raw text as the response so the user still sees something
          chatResult = {
            updatedQuote: null,
            response: textContent,
            whatIf: false,
            changesSummary: null,
            error: 'Could not parse quote update from AI response'
          };
        }

        return new Response(JSON.stringify({
          updatedQuote: chatResult.updatedQuote || null,
          response: chatResult.response || 'I processed your request but could not generate a response.',
          whatIf: chatResult.whatIf || false,
          changesSummary: chatResult.changesSummary || null,
          model,
          usage: geminiResponse.usageMetadata
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // ── QUOTE MODE: Generate a new quote (existing flow, unchanged) ──
      const model = body.model || 'gemini-2.5-flash';
      const isGemini3 = model.startsWith('gemini-3');

      // For Gemini 3, don't use structured output (causes precision bugs)
      // Instead, ask for JSON in the user message
      let messages = body.messages;
      if (isGemini3) {
        // Append JSON format instructions to the last user message
        const lastMsgIndex = messages.length - 1;
        const jsonInstructions = `\n\nIMPORTANT: Return ONLY a valid JSON object with these exact fields:
{
  "booth_specs": { "dimensions": "string", "square_footage": number, "location": "string", "event_name": "string", "duration_days": number },
  "project_type": "toronto_standard" | "toronto_festival" | "outoftown" | "fabrication_only",
  "materials": {
    "walls": number, "walls_line_items": [{"item": "string", "qty": number, "dimensions": "string", "unit_price": "string", "extended": number, "confidence": "high"|"medium"|"low"}],
    "flooring": number, "flooring_line_items": [...],
    "graphics": number, "graphics_line_items": [...],
    "av_lighting": number, "av_lighting_line_items": [...],
    "furniture": number, "furniture_line_items": [...],
    "other": number, "other_line_items": [...],
    "subtotal": number
  },
  "services": {
    "design_pm": number, "design_pm_percent": number, "design_pm_note": "string explaining basis (e.g., '7.2% of fabrication subtotal, quoted as lump sum')",
    "install_dismantle": number, "install_dismantle_percent": number, "install_dismantle_line_items": [{"item": "string", "qty": number, "dimensions": "string (e.g., '18 hrs install + 8 hrs dismantle')", "unit_price": "string", "extended": number}],
    "logistics": number, "logistics_percent": number, "logistics_line_items": [...],
    "storage": number, "storage_line_items": [...],
    "subtotal": number
  },
  "contingency": number,
  "subtotal_before_tax": number,
  "tax_rate": number,
  "tax_amount": number,
  "total": number,
  "confidence": "high" | "medium" | "low",
  "notes": ["string", ...]
}
CRITICAL RULES:
1. Extract booth_specs from the PDF content - dimensions, square footage, location, event name.
2. EVERY category with a non-zero dollar amount MUST have line_items showing what makes up that number.
3. For walls: itemize each wall section (e.g., "Back Wall Outside - Painted MDF", qty, dimensions, $/sqft, extended).
4. For services: show percentage basis and calculation (e.g., "Design/PM @ 7.2% of $52,604").
5. For I&D: show crew count, hours/days, and implied rate if calculable.
6. Use whole numbers for dollar amounts. No markdown, no explanation, just the JSON.`;
        messages = messages.map((msg, i) =>
          i === lastMsgIndex ? { ...msg, content: msg.content + jsonInstructions } : msg
        );
      }

      const geminiRequest = {
        contents: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          // Only use structured output for non-Gemini-3 models
          ...(isGemini3 ? {} : { responseMimeType: 'application/json', responseSchema: QUOTE_SCHEMA }),
          temperature: 0.1,
          maxOutputTokens: 4096,
          ...(isGemini3 && { thinkingConfig: { thinkingLevel: 'LOW' } })
        }
      };

      // Call Gemini API
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
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const geminiResponse = await response.json();

      // Extract the text from Gemini's response structure
      const textContent = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error('No content in Gemini response');
      }

      // Try to clean and parse the JSON - Gemini 3 sometimes includes extra content
      let cleanedText = textContent.trim();

      // Remove any markdown code fences if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      // Find the JSON object boundaries
      const jsonStart = cleanedText.indexOf('{');
      const jsonEnd = cleanedText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedText = cleanedText.slice(jsonStart, jsonEnd + 1);
      }

      // Parse the structured JSON
      const quote = JSON.parse(cleanedText);

      return new Response(JSON.stringify({
        quote,
        model,
        usage: geminiResponse.usageMetadata
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        type: 'worker_error'
      }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};
