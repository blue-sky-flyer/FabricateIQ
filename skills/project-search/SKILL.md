---
name: project-search
description: Search historical booth projects by client, type, size, or specifications. Use when finding similar projects, reference quotes, or past work examples.
---

# Project Search

Find relevant historical projects from the FabricateIQ knowledge base.

## Project Index

| ID | Client | Type | Location | Total | Currency | $/sqft |
|----|--------|------|----------|-------|----------|--------|
| 8498 | Intel/Best Buy | Gift shop activation | Toronto | $52,604 | CAD | $263 |
| 2572 | Starbucks | Mobile tour | USA multi-city | $132,790 | USD | N/A |
| 6805 | Johnnie Walker | Mall activation | Toronto (Yorkdale) | $86,743 | CAD | ~$430 |
| 8469 | Samsung/Best Buy | Chalet activation | Toronto | $72,421 | CAD | $362 |
| 2514 | 7-Eleven | Experiential | USA | $60,697 | USD | N/A |
| 7634 | Mike's Hard | Props + graphics | Canada | $3,644 | CAD | N/A |
| 7859 | Smirnoff | Pride ball pit | Toronto | $38,631 | CAD | $386 |
| 7974 | eBay | Trade show (MTCC) | Toronto | $87,216 | CAD | $73* |
| 8248 | Campbell's | Experiential | Canada | $39,039 | CAD | ~$390 |
| 7643 | Cutwater | Prop (riser) | Canada | $500 | CAD | N/A |
| 6983 | CCM Hockey | Venue takeover | Montreal | $179,609 | CAD | N/A |

*eBay was a reuse project with existing AGAM frames

## Search Criteria

### By Client Name
- Direct match: "Samsung", "Intel", "Starbucks"
- Returns: Project details, key components, total quote

### By Project ID
- Format: 4-digit number (e.g., "8498", "6983")
- Returns: Full project details

### By Project Type
| Type | Projects |
|------|----------|
| trade_show | eBay 7974 |
| mall_activation | JW 6805 |
| experiential | Intel 8498, Campbell's 8248, 7-Eleven 2514 |
| mobile_tour | Starbucks 2572 |
| venue_takeover | CCM Hockey 6983 |
| props_only | Mike's Hard 7634, Cutwater 7643 |
| pride_festival | Smirnoff 7859 |

### By Booth Size
| Size Range | Projects |
|------------|----------|
| Small (<150 sqft) | Smirnoff (100 sqft) |
| Medium (150-250 sqft) | Intel (200 sqft), Samsung (200 sqft) |
| Large (250-500 sqft) | Campbell's, JW |
| Extra Large (500+) | eBay (1,200 sqft) |

### By Budget Range
| Range | Projects |
|-------|----------|
| < $10,000 | Mike's Hard, Cutwater |
| $10,000-$50,000 | Smirnoff |
| $50,000-$100,000 | Intel, Samsung, eBay, JW |
| > $100,000 | Starbucks, CCM Hockey |

### By Key Components
- **Lightboxes**: Intel 8498, Campbell's 8248
- **Custom counters**: Intel 8498
- **G-Floor**: eBay 7974, JW 6805
- **Neon signs**: CCM Hockey 6983
- **Ball pit**: Smirnoff 7859
- **Bars**: Samsung 8469, eBay 7974

## Project Folders

Detailed project files are stored at:
```
Training Files/{ID} {Client}/
```

Each folder typically contains:
- `Estimate 1.pdf` - Original vendor quote
- `Render 1.pdf` or `.png` - Visual design
- `estimate_extraction.json` - Parsed line items
- `render_analysis.json` - Component breakdown
- `{client}_pricing_analysis.md` - Detailed analysis

## Response Format

When returning project matches:

```markdown
## [Project ID] [Client Name]

**Type:** [Project type]
**Location:** [City, venue]
**Total:** $XX,XXX [CAD/USD]
**Size:** [dimensions] ([sqft] sq ft)
**$/sqft:** $XXX

**Key Components:**
- [Notable item 1]
- [Notable item 2]

**Useful For:** [Why this project is relevant to the query]

**Files:** `Training Files/{ID} {Client}/`
```

## Example Queries

**"Show me projects similar to a 20x10 trade show booth"**
→ Return Intel 8498 ($52,604, 20x10, gift shop style) and Samsung 8469 ($72,421, 20x10, premium finishes)

**"What did we do for Samsung?"**
→ Return Samsung 8469 details with component breakdown

**"Find projects with custom bars"**
→ Return Samsung 8469 (premium bar $7,812) and eBay 7974 (plexi bar $2,530)

**"Show experiential projects under $50K"**
→ Return Smirnoff 7859 ($38,631) and Campbell's 8248 ($39,039)
