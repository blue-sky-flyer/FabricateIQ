---
name: quote-generator
description: Generate trade show booth quotes from requirements. Use when creating quotes, pricing booths, estimating project costs, or when user asks "how much" for a booth.
---

# Quote Generator

Generate accurate trade show booth quotes from natural language requirements, structured specifications, or project references.

## Input Formats

1. **Natural language**: "I need a 10x20 booth with backwall and 2 demo stations for Toronto"
2. **Structured**: Booth size, component list, location, event dates
3. **Reference**: "Similar to project 8498 Intel but smaller"

## Quote Generation Process

### Step 1: Parse Requirements

Extract from user input:
- **Booth dimensions** (width x depth in feet)
- **Location** (city, venue name, union status)
- **Components** (walls, furniture, graphics, AV)
- **Material preferences** (standard vs premium)
- **Event type** (trade show, mall, experiential, venue takeover)

If missing critical info, ask clarifying questions or use defaults with notes.

### Step 2: Calculate Component Costs

Use the embedded pricing reference below. For each component:
1. Determine dimensions/quantity
2. Apply appropriate unit price
3. Note confidence level (HIGH if Toronto data, LOW if extrapolated)

### Step 3: Calculate Services

Apply Toronto baseline ratios (adjust for location):
- **Design/PM**: 7-16% of fabrication subtotal
- **I&D Labor**: 11-17% (higher for union venues)
- **Logistics**: 4-6% local, 12%+ out-of-town
- **Storage**: $275/skid/month if needed

**Location adjustments (see full city table below):**
- Toronto: Design/PM 7-12%, I&D 11-17%, Logistics 4-6%
- Montreal/out-of-town: Use 60-75% total services (observed: CCM Hockey 71.8%)
- Vancouver: 1.30× Toronto I&D rate (BC union market)
- US cities: apply city-specific rates from the table in "US City Service Rates" section
- Union venue (MTCC/major convention centers): Add 3-5% to I&D

### Step 4: Generate Output

Produce itemized quote with:
- **Line items for EVERY category**: each wall section, flooring area, graphic element, furniture piece must be its own line item with qty, dimensions, unit price, and extended price
- **Service breakdown with basis**: show the percentage and what it's a percentage OF (e.g., "Design/PM @ 7.2% of $52,604 fabrication subtotal = $3,775")
- **I&D detail**: where possible, show crew size, hours/days, and implied rate
- Subtotal, tax (13% HST for Ontario), total
- Confidence indicators per line (HIGH/MEDIUM/LOW)
- Reference to similar historical projects

**The customer expects to see the math behind every number.** A line saying "Walls: $8,800" is insufficient. It must be "Back Wall Outside Sections - Painted MDF, Qty 2, 8'x8' each (128 sqft), $68.75/sqft = $8,800".

---

## Chat Adjustment Mode

When adjusting an existing quote via chat (mode: "chat"), the user's current quote JSON is provided as context. Follow these rules:

1. **Preserve unchanged items** — only modify the specific line items the user mentions. Do NOT regenerate the entire quote from scratch; carry forward all unchanged categories and line items exactly as-is.
2. **Recalculate cascading totals** — services are percentage-based on materials subtotal, so any material change must cascade: materials subtotal → services → contingency → subtotal before tax → tax → total.
3. **Show the math** — in your natural-language response, explain what changed: old value → new value, and net impact on total (e.g., "Flooring dropped from $5,454 to $2,860, saving $2,594. With cascading adjustments, new total is $48,107 — saved $3,416").
4. **What-if questions** — if the user asks "what if", "what would it cost", or is exploring without committing, set `whatIf: true` in your response. Show the comparison but make clear the change is not yet applied.
5. **Undo/revert requests** — when asked to revert a change, apply it selectively. For example, "go back to G-Floor" should revert only the flooring while keeping other changes (like added furniture) intact.
6. **Return format** — always return a JSON object with these fields:
   - `updatedQuote`: the complete quote JSON (same schema as the original), with changes applied
   - `response`: natural-language explanation of what changed and cost impact
   - `whatIf`: boolean (true if this is exploratory, false if the change should be applied)
   - `changesSummary`: short label for version history (e.g., "Swapped G-Floor for Printed Vinyl")

---

## Pricing Reference (Toronto CAD)

### Walls $/sqft
| Material | Price | Confidence |
|----------|-------|------------|
| Painted MDF | $68.75 | HIGH |
| Oak Wood | $103.13 | HIGH |
| AGAM + SEG (rental) | $30.71 avg ($14.67-$46.75) | HIGH |
| Complex millwork | $157.78 | MEDIUM |

### Flooring $/sqft
| Type | Price | Confidence |
|------|-------|------------|
| Standard carpet | $5.50 | HIGH |
| Printed vinyl | $14.30 avg ($12.10-$16.50) | HIGH |
| G-Floor new | $27.27 avg ($25.21-$29.33) | HIGH |
| G-Floor reprint | $10.86 | MEDIUM |
| Astro turf (outdoor) | $16.92 | LOW |

### Furniture (per unit)
| Item | Price | Confidence |
|------|-------|------------|
| Custom counter (4'x4', MDF) | $4,400 | HIGH |
| Wood plinth with power | $2,750 | HIGH |
| Vinyl wrap podium | $1,320 | HIGH |
| LED display podium | $3,685 | MEDIUM |
| Premium bar | $976/linear ft | MEDIUM |
| Plexi bar (6') | $2,530 | MEDIUM |
| Sampling table (6') | $2,700 ($450/ft) | MEDIUM |
| Simple MDF riser/pedestal (vinyl wrap INCLUDED) | $500-700 all-in | HIGH |

### Graphics & Signage
| Type | Price | Confidence |
|------|-------|------------|
| Lightbox (illuminated) | $825/sqft | HIGH |
| Dimensional acrylic | $550/sqft | MEDIUM |
| Halo LED header | $660 each | MEDIUM |
| Large neon (7'x4-6') | $2,585 | LOW (Montreal) |
| SEG fabric | $34.04/sqft avg | HIGH |
| Vinyl wrap | $19.80/sqft | HIGH |
| T-stand frame | $165 | HIGH |
| Foamcore insert | $82.50 | HIGH |

### Shelving
| Item | Price | Notes |
|------|-------|-------|
| Floating shelf 48" (bulk) | $64/shelf | 6-pack pricing |
| Floating shelf 48" (single) | $275/shelf | Change order pricing |

### Service Ratios (Standard Toronto)
| Service | Typical | Range |
|---------|---------|-------|
| Design/PM | 10% | 7-12% |
| I&D Labor | 15% | 13-17% |
| Logistics | 5% | 5-6% |
| **Total Services** | **30%** | **28-32%** |

**NOTE:** If your services calculate below 28%, you're likely underestimating. Standard Toronto builds rarely have services below 28%.

### Non-Standard Hours Projects (Festivals, Weekends, After-Hours)

**When to apply non-standard hours premium:**
- Festival activations (Pride, CNE, TIFF, etc.)
- Weekend-only install windows
- Overnight or after-hours work required
- Tight timelines with compressed schedules
- Outdoor events with weather contingencies

**Service Ratios (Non-Standard Hours)**:
| Service | Rate | Notes |
|---------|------|-------|
| Design/PM | 10-12% | Same as standard |
| I&D Labor | **20-22%** | Premium for timing |
| Logistics | **8-10%** | Timed deliveries |
| Staging | 3-4% | Pre-event prep |
| **Total Services** | **38-42%** | NOT 25-30%! |

**Example (Pride Festival activation)**:
- Fabrication: $23,000
- Services @ 40%: $15,300 (NOT $7,000 @ 30%)
- Total: $38,300

**Validation**: If it's a festival/weekend project and services are below 35%, you're underestimating.

### Fabrication-Only Projects (0% Services)

**IMPORTANT**: When the scope explicitly excludes services, apply **0% services** — no Design/PM, no I&D, no logistics.

**Indicators of fabrication-only scope:**
- "No installation services included"
- "No I&D" or "No install/dismantle"
- "Local pickup" or "client pickup"
- "Fabrication only"
- "No logistics included"
- Single component orders (risers, pedestals, props)

**Pricing approach for simple items:**
- Use **all-in reference prices** from the Furniture table above
- Do NOT decompose into materials + labor + engineering
- A "pedestal with vinyl wrap" = $500-700 total, not $2,000+ in parts

**Example**: MDF riser 48"×36"×30" with vinyl wrap
- ✅ Correct: $500-700 total (vinyl wrap INCLUDED, 0% services) = ~$565-790 with HST
- ❌ Wrong: $650 pedestal + $400 vinyl wrap + $300 engineering + 10% PM = $1,200+
- ❌ Wrong: Decomposing into materials + labor + engineering

### Out-of-Town Projects (Montreal, etc.)

**When to apply out-of-town rates:**
- Location is Montreal, Quebec, Vancouver, USA, or anywhere outside Greater Toronto Area (GTA)
- Brief mentions "travel", "out-of-town", or crew coming from Toronto
- Venue is in a different province or country from the vendor
- Project requires overnight stays for crew

For projects outside Toronto/GTA, services increase significantly due to travel and specialized labor.

**CRITICAL: Out-of-Town Labor Rates (per labourer/day)**

USE THESE RATES EXACTLY - they include all overhead, tools, insurance, and are much higher than local rates:

| Role | Daily Rate | DO NOT USE |
|------|-----------|------------|
| Vinyl specialist | **$3,000-3,500/day** | NOT $500-800/day |
| General labour | **$1,700-2,200/day** | NOT $400-700/day |
| Overtime premium | **1.5x base rate** | For overnight work |

**Example calculation (vinyl install)**:
- 5 vinyl specialists × 2 install days × $3,200/day = **$32,000**
- NOT: 5 × 2 × $850 = $8,500 (WRONG - too low!)

**Travel & Per Diem**:
| Item | Rate | Notes |
|------|------|-------|
| Per diem | $350-450/person/day | Hotels + meals |
| Site visits | $1,300-1,500/trip | Pre-install scouting |

**Service Percentages (use as validation)**:
| Service | Out-of-Town Rate |
|---------|------------------|
| Design/PM | 12-15% of total |
| I&D Labor | 35-40% of total |
| Logistics | 10-12% of total |
| Travel/Per Diem | Calculate separately |
| Repair Budget | 3-5% of total |
| **Total Services** | **60-75% of total** |

**Validation check**: If your total services are below 60%, you probably used wrong labor rates.

**Tax Notes**:
- Ontario: 13% HST
- Quebec: GST 5% + QST 9.975% = **14.975%**
- British Columbia: 5% GST + 7% PST = **12%**
- New York: **8.875%** combined
- California (LA, SF): **10.25%** combined
- Texas (Dallas, Houston, Austin): **8.25%**
- Massachusetts (Boston): **6.25%**
- Illinois (Chicago): **10.25%** combined
- Florida (Miami): **7–8%** (county-dependent; Miami-Dade ~7%)
- Georgia (Atlanta): **4%** state + local = ~8.9% combined
- Washington (Seattle): **10.35%** combined
- Pennsylvania (Philadelphia): **8%** combined
- Missouri (Kansas City): **9.6%** combined
- Nevada / other USA: varies — default 8-10% if unknown

### US City Service Rates

Rates derived from 2022 Exhibitor Advocacy Rate Survey. Apply Design/PM and I&D as % of fabrication subtotal. Currency: USD for all US cities.

| City | Market | Design/PM | I&D Labor | Logistics | Notes |
|------|--------|-----------|-----------|-----------|-------|
| **Vancouver, BC** | Union | 10% | 18% | 8% | 1.30× Toronto; BC Building Trades |
| **New York / NJ** | Heavy union | 10% | 36% | 18% | 2.55× Toronto; Teamsters/Carpenters/IBEW; Javits/MetLife |
| **Boston / Foxborough** | Union | 10% | 31% | 17% | 2.20×; Carpenters/IATSE; BCEC & Gillette |
| **Philadelphia** | Heavy union | 10% | 34% | 18% | 2.40×; highest material handling in US; PCC & Lincoln Financial |
| **Chicago** | Heavy union | 10% | 28% | 17% | 2.00×; McCormick Place all-trades; verified rates Dec 2024 |
| **Kansas City** | Mixed | 10% | 16% | 16% | 1.15×; KCCC limited union; Arrowhead |
| **Dallas** | Open shop | 10% | 14% | 15% | 0.97×; Kay Bailey Hutchison CC; AT&T Stadium |
| **Houston** | Open shop | 10% | 14% | 15% | 1.03×; George R. Brown CC; NRG Stadium |
| **Austin** | Open shop | 10% | 15% | 15% | 1.10×; Austin CC; non-union advantage |
| **Miami** | Union | 10% | 24% | 16% | 1.70×; Local 1175 Decorators; MBCC & Hard Rock |
| **Atlanta** | Open shop | 10% | 13% | 15% | 0.90×; GWCC non-union = **lowest cost US market**; Mercedes-Benz |
| **Los Angeles** | Union | 10% | 33% | 18% | 2.35×; IATSE Local 831; LACC & SoFi |
| **Seattle** | Union | 10% | 25% | 17% | 1.80×; Carpenters/IBEW/IATSE; WSCC & Lumen Field |
| **San Francisco BA** | Heavy union | 10% | 36% | 19% | 2.60×; CA prevailing wage + Bay Area premium; Moscone & Levi's |

**Important notes for US cities:**
- All US quotes should be in **USD**
- Stadium venues (MetLife, SoFi, AT&T, NRG, etc.) may have additional union rules vs convention centers — apply same city rates but note it in assumptions
- Open-shop cities (Dallas, Houston, Austin, Atlanta) allow non-union labor; budget accordingly
- Heavy-union cities (NYC, Chicago, Philadelphia, SF): budget for 4-hour minimums, show-site surcharges, and triple-time holidays

### Project Benchmarks $/sqft
| Type | Range | Notes |
|------|-------|-------|
| Standard booth (new) | $260-400 | Custom build |
| Standard booth (reuse) | $55-75 | Existing frames |
| Mall activation | $400-450 | Premium finishes |
| Experiential | $260-390 | Props add cost |
| Venue takeover | N/A | 60-75% services |

---

## Output Format Template

```markdown
# FabricateIQ Quote Estimate

**Project:** [Description]
**Booth:** [W]' x [D]' ([sqft] sq ft)
**Location:** [City, Venue]
**Date Generated:** [Date]

## Fabrication

| Item | Qty | Dimensions | Unit Price | Extended | Conf |
|------|-----|------------|------------|----------|------|
| [Component] | [#] | [dims] | [$X.XX/unit] | $X,XXX | [H/M/L] |
| ... | | | | | |

**Fabrication Subtotal:** $XX,XXX

## Services

| Service | Rate | Amount |
|---------|------|--------|
| Design/Project Management | X% | $X,XXX |
| Installation & Dismantle | X% | $X,XXX |
| Logistics | X% | $X,XXX |

**Services Subtotal:** $X,XXX

---

**Subtotal:** $XX,XXX
**HST (13%):** $X,XXX
**TOTAL:** $XX,XXX CAD

## Notes
- [Assumptions made]
- [Similar project references]
- [Confidence level explanation]
```

---

## Examples

**Example 1: Simple booth**
User: "Quote a 10x10 booth for Toronto with MDF backwall and 1 counter"

Calculation:
- Backwall: 10' x 8' = 80 sqft @ $68.75 = $5,500
- Counter: 1 @ $4,400 = $4,400
- Flooring: 100 sqft @ $5.50 = $550
- Subtotal: $10,450
- Services (30%): $3,135
- HST (13%): $1,766
- **Total: $15,351**

**Example 2: Premium activation**
User: "20x20 experiential booth with oak walls, G-floor, 2 lightboxes, and a bar"

Calculation:
- Walls: 40' perimeter x 8' = 320 sqft @ $103.13 = $33,002
- G-Floor: 400 sqft @ $27.27 = $10,908
- Lightboxes: 2 @ 4sqft each @ $825 = $6,600
- Bar: 8' @ $976/ft = $7,808
- Subtotal: $58,318
- Services (35%): $20,411
- HST (13%): $10,235
- **Total: $88,964**

**Example 3: Out-of-town (Montreal)**
User: "Multi-room venue activation in Montreal with large vinyl graphics, 2-day install, overnight dismantle"

Calculation:
- Fabrication (graphics, AGAM, etc.): $50,000
- Services breakdown:
  - Design/PM (12% of total): ~$22,000
  - Vinyl I&D: 5 labourers × 3 days × $3,200/day = $48,000
  - General labour: 4 labourers × 2.5 days × $2,000/day = $20,000
  - Logistics (12%): ~$7,000
  - Travel: 9 people × 5 days × $400/day = $18,000
  - Site visits: 2 × $1,300 = $2,600
  - Repair budget (3%): ~$5,500
  - Equipment rental: $5,000
- Services subtotal: ~$128,000
- **Total services: 72% of project**
- Grand total before tax: ~$178,000
- Quebec tax (14.975%): ~$26,700
- **Total: ~$205,000 CAD**

**Example 4: Fabrication-only (simple component)**
User: "Single display pedestal 48×36×30 with vinyl wrap, local pickup, no services"

Calculation:
- Pedestal with vinyl wrap: 1 @ $500 = $500 (all-in reference price)
- Additional vinyl wrap: $0 (ALREADY INCLUDED in pedestal price above)
- Services: $0 (scope says "no services", "local pickup")
- Subtotal: $500
- HST (13%): $65
- **Total: $565 CAD**

Key points:
- Used reference price, did NOT decompose into materials + labor
- Did NOT add vinyl wrap separately — it's included in the $500-700 reference
- Applied 0% services because scope explicitly excluded them
- Simple single-unit order = use furniture table pricing

---

## When to Consult Full Catalog

Use the `catalog-query` skill or read MASTER_CATALOG.md directly when:
- Component not in embedded pricing above
- Need detailed vendor comparison
- Need historical project details
- Location-specific pricing required (Montreal, USA)
- User asks about data confidence or sources
