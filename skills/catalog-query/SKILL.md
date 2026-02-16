---
name: catalog-query
description: Query booth component pricing from knowledge base. Use when looking up specific prices, materials, specifications, or historical data for booth components.
---

# Catalog Query

Retrieve accurate pricing data from the FabricateIQ knowledge base.

## Knowledge Base Files

| File | Path | Contents |
|------|------|----------|
| MASTER_CATALOG.md | `Processed Files/MASTER_CATALOG.md` | Human-readable pricing reference |
| components.json | `Processed Files/components.json` | Structured component data |

## Query Types

### 1. Component Price Lookup
**User asks:** "What does painted MDF wall cost?"
**Action:** Return unit price, dimensions, confidence level, source project

### 2. Category Browse
**User asks:** "Show all flooring options"
**Action:** List all items in category with prices and notes

### 3. Material Comparison
**User asks:** "Compare MDF vs oak walls"
**Action:** Show price difference, premium factor, pros/cons

### 4. Service Ratio Lookup
**User asks:** "What's typical I&D cost for Toronto?"
**Action:** Return percentage range and typical value

### 5. Project Type Benchmark
**User asks:** "What does a 10x10 booth typically cost?"
**Action:** Return $/sqft range and total estimate

### 6. Location-Specific Pricing
**User asks:** "Do you have Montreal pricing?"
**Action:** Return available data with confidence notes

## How to Query

1. **For common components**: Check quote-generator skill's embedded pricing first
2. **For detailed data**: Read MASTER_CATALOG.md via filesystem MCP
3. **For structured queries**: Read components.json via filesystem MCP

## Response Format

```markdown
## [Component Name]

**Price:** $X.XX per [unit]
**Source:** [Project ID, Client]
**Location:** [City]
**Confidence:** [HIGH/MEDIUM/LOW]
**Notes:** [Any relevant context]
```

## Data Confidence Levels

| Level | Meaning | Sample Size |
|-------|---------|-------------|
| **HIGH** | Multiple data points, consistent | 3+ projects |
| **MEDIUM** | Limited data but reliable | 1-2 projects |
| **LOW** | Single observation or extrapolated | 1 project or derived |

## Location Coverage

| Location | Projects | Confidence |
|----------|----------|------------|
| Toronto, ON | 8 | HIGH |
| Montreal, QC | 1 | LOW |
| USA (various) | 2 | LOW |

## Known Gaps

These components have limited or no pricing data:
- Video walls / LED panels (only rental observed)
- Hanging signs / rigging
- Audio systems
- Interactive kiosks
- Non-Toronto union venues

When data is unavailable, state clearly: "No pricing data available for [X]. Suggest obtaining vendor quote."
