/**
 * FabricateIQ Vendor Refresh Worker
 *
 * Handles two responsibilities:
 * 1. Scheduled cron (every 3 months): refreshes vendor data in KV by calling Claude API
 * 2. GET /vendors?city=<location_key>: returns vendor data for a city (from KV or seed)
 *
 * Model: all vendors listed are LOCAL companies in the target city that can execute
 * the full project (design, fabrication, I&D, rentals). These are PTNR-equivalent
 * companies in each market — not subcontractors for Toronto-outbound work.
 *
 * Vendor categories (aligned with user's 4 requested types):
 *   - Exhibit Fabricators / Builders — custom build, full-service (PTNR equivalents)
 *   - Rental Companies — modular systems, furniture, flooring, AV
 *   - Graphics / Print Shops — large-format printing for booth graphics
 *   - General Contractors / I&D Labor — assembly and dismantle crews
 *
 * KV bindings: VENDOR_KV
 * Secrets: ANTHROPIC_API_KEY, WORKER_AUTH_TOKEN
 */

import { handleCors, verifyAuth, sanitizeError } from './middleware.js';

// ---------------------------------------------------------------------------
// Seed vendor data — used as fallback when KV is empty (e.g. before first cron)
// Populated from 2026 research. Refresh quarterly via scheduled cron.
// ---------------------------------------------------------------------------
const VENDOR_SEED = {
  toronto: {
    'Exhibit Fabricators / Builders': [
      { name: 'PTNR Production Inc', specialty: 'Custom trade show fabrication, experiential activations', website: 'ptnrproduction.com', notes: 'Home base — primary vendor for all Toronto work', union: 'Non-union' },
      { name: 'Nimlok Toronto', specialty: 'Modular and custom exhibit design & build', website: 'nimlok.ca', notes: 'Full-service exhibit house', union: 'Non-union' },
      { name: 'Derse', specialty: 'Custom exhibit design and lifecycle management', website: 'derse.com', notes: 'Large-scale custom builds', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Freeman', specialty: 'Modular systems, furniture, flooring rentals', website: 'freemanco.com', notes: 'National provider; large rental inventory', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture and accessories', website: 'cortevents.com', notes: 'Wide furniture selection; national coverage', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Pixel Graphics', specialty: 'Large-format printing, SEG fabric, vinyl wraps', website: 'pixelgraphics.ca', notes: 'Trade show specialist; fast turnaround', union: 'Non-union' },
      { name: 'SpeedPro Toronto', specialty: 'Banners, backdrops, floor graphics', website: 'speedpro.com', notes: 'National franchise', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'PTNR Production Inc', specialty: 'Install and dismantle crew — all Toronto shows', website: 'ptnrproduction.com', notes: 'In-house crew', union: 'Non-union' },
      { name: 'Complete Crewing Inc.', specialty: 'Union-capable installation crews', website: 'completecrewing.com', notes: 'For union venue requirements', union: 'Union-signatory' },
    ],
  },
  montreal: {
    'Exhibit Fabricators / Builders': [
      { name: 'Evo Exhibits', specialty: 'Custom exhibits, modular systems, full turnkey', website: 'evoexhibits.com', notes: 'Montreal-based full-service exhibit builder', union: 'Non-union' },
      { name: 'CoMotion Exhibits Events Inc', specialty: 'Custom exhibits, fabrication, installation', website: 'comotioneventsinc.com', notes: 'Serves Montreal, Toronto, Vancouver', union: 'Non-union' },
      { name: 'Beaumont Exhibits', specialty: 'Turnkey exhibit design and production', website: 'beaumontandco.ca', notes: '20+ years; multi-city capability', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Freeman Canada', specialty: 'Modular displays, furniture, flooring rentals', website: 'freemanco.com', notes: 'National provider; serves Montreal shows', union: 'Varies by venue' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture rentals', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Transcontinental Printing', specialty: 'Large-format, trade show graphics, signage', website: 'transcontinental.com', notes: 'National print provider with Montreal facilities', union: 'Non-union' },
      { name: 'SpeedPro Montreal', specialty: 'Banners, vinyl wraps, booth graphics', website: 'speedpro.com', notes: 'National franchise; fast turnaround', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'GES Canada', specialty: 'General contractor for Montreal trade shows', website: 'ges.com', notes: 'National GC; Quebec shows specialist', union: 'Union at Palais des congrès' },
      { name: 'Freeman Canada', specialty: 'Official GC services, installation labor', website: 'freemanco.com', notes: 'Large national GC', union: 'Union at major venues' },
    ],
  },
  vancouver: {
    'Exhibit Fabricators / Builders': [
      { name: 'Müller Expo', specialty: 'Custom booth design, fabrication, installation', website: 'mullerexpo.com', notes: 'Vancouver production facility; full-service', union: 'Non-union' },
      { name: 'Beaumont Exhibits', specialty: 'Turnkey exhibit solutions, design & fabrication', website: 'beaumontandco.ca', notes: '20+ years; Vancouver-based', union: 'Non-union' },
      { name: 'MJY Fabrication', specialty: 'Custom trade show exhibit builds, design to install', website: 'mjyfabrication.com', notes: 'Local Vancouver fabricator', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Freeman Canada', specialty: 'Modular systems, furniture, flooring rentals', website: 'freemanco.com', notes: 'Serves Vancouver Convention Centre', union: 'Union at VCC' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'SpeedPro Vancouver', specialty: 'Large-format printing, trade show graphics', website: 'speedpro.com', notes: 'National franchise; fast turnaround', union: 'Non-union' },
      { name: 'ColorBurst Graphics', specialty: 'Trade show banners, backlit displays, vinyl wraps', website: 'colorburstgraphics.ca', notes: 'Vancouver trade show specialist', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Whistler Show Services', specialty: 'Installation & dismantle labor — VCC specialist', website: 'whistlershowservices.com', notes: 'Official EAC at Vancouver Convention Centre', union: 'Union (BC Building Trades)' },
      { name: 'GES Canada', specialty: 'General contractor for Vancouver shows', website: 'ges.com', notes: 'National GC; VCC experience', union: 'Union at VCC' },
    ],
  },
  new_york: {
    'Exhibit Fabricators / Builders': [
      { name: 'Zumizo International', specialty: 'Custom trade show booths, design to install', website: 'zumizointernational.com', notes: '2 decades NYC experience; full-service', union: 'Non-union' },
      { name: 'Sparks', specialty: 'Large custom exhibits, brand environments', website: 'wearesparks.com', notes: 'Major full-service exhibit house; NYC/NJ', union: 'Non-union' },
      { name: 'Highmark Tech', specialty: 'Custom & modular exhibit design and build', website: 'highmarktech.com', notes: 'NYC area exhibit builder', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture, flooring', website: 'exponents.com', notes: 'Nationwide rental network; Javits specialist', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture rentals', website: 'cortevents.com', notes: 'Large NYC inventory', union: 'Non-union' },
      { name: 'Iconic Displays', specialty: 'Display system rentals, modular hardware', website: 'iconicdisplays.com', notes: 'Multiple NYC-area offices', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Mega Format NYC', specialty: 'Trade show banners, vinyl wraps, large format', website: 'megaformat.net', notes: 'Brooklyn location; wide material options; rush services', union: 'Non-union' },
      { name: 'Color X', specialty: 'Large format, floor graphics, window displays', website: 'color-x.com', notes: 'Custom fabrication capability', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Freeman', specialty: 'Official GC — Javits Center material handling & labor', website: 'freemanco.com', notes: 'Primary contractor at Javits; Teamsters required', union: 'Union (Teamsters/Carpenters/IBEW)' },
      { name: 'Expo Event Services', specialty: 'EAC labor, furniture, on-site management', website: 'expoeventservices.com', notes: 'Exhibitor-appointed contractor; Javits specialist', union: 'Union-coordinated' },
    ],
  },
  boston: {
    'Exhibit Fabricators / Builders': [
      { name: 'Cardinal Expo', specialty: 'Custom booth rental, fabrication, installation', website: 'cardinalexpo.com', notes: 'Full-service exhibit house; BCEC specialist', union: 'Non-union' },
      { name: 'Müller Expo', specialty: 'Custom exhibit design, fabrication, installation', website: 'mullerexpo.com', notes: 'National coverage with Boston capability', union: 'Non-union' },
      { name: 'Vivid Exhibits', specialty: 'Custom and rental booth solutions', website: 'vividexhibits.com', notes: 'Boston area exhibit house', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exponents', specialty: 'Turnkey booth rentals, furniture, flooring, AV', website: 'exponents.com', notes: 'BCEC and Hynes CC specialist; full packages', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture rentals', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'ICL Imaging', specialty: 'SEG fabric, tension fabric displays, rigid graphics', website: 'icl-imaging.com', notes: 'First in New England for fabric banner printing', union: 'Non-union' },
      { name: 'SpeedPro Boston Metrowest', specialty: 'Trade show graphics, banners, retail signage', website: 'speedpro.com', notes: 'National franchise; fast turnaround', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Freeman', specialty: 'Official GC — BCEC and major Boston shows', website: 'freemanco.com', notes: 'Primary GC; union labor required at BCEC', union: 'Union (Carpenters/IATSE)' },
      { name: 'GES', specialty: 'General service contractor; Boston shows', website: 'ges.com', notes: 'National GC with Boston experience', union: 'Union at major venues' },
    ],
  },
  philadelphia: {
    'Exhibit Fabricators / Builders': [
      { name: 'Metro Exhibits', specialty: 'Custom exhibits, full-service, PCC specialist', website: 'metroexhibits.com', notes: 'Philadelphia Convention Center specialist', union: 'Non-union' },
      { name: 'Airborne Visuals', specialty: 'Display systems, raised flooring, custom builds', website: 'airbornevisuals.com', notes: 'PCC exhibitor services; ARES-X flooring', union: 'Non-union' },
      { name: 'Exponents', specialty: 'Turnkey exhibit rentals and custom builds', website: 'exponents.com', notes: 'National coverage with Philadelphia presence', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture, modular displays', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture rentals', website: 'cortevents.com', notes: 'Philadelphia inventory', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Color Reflections', specialty: 'Event branding, convention banners, retractable banners', website: 'colorreflections.com', notes: 'Convention & retail display expertise', union: 'Non-union' },
      { name: 'PDC Graphics', specialty: 'Booth backdrops, banner stands, hanging signs', website: 'pdcgraphics.com', notes: 'PCC exhibitor-focused', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Pennsylvania Convention Center Exhibitor Services', specialty: 'Official labor coordination', website: 'paconvention.com', notes: 'Contact: 215-418-2190; exhibitorservices@paconvention.com', union: 'Union (Carpenters/Teamsters/IBEW/IATSE)' },
      { name: 'Freeman', specialty: 'Official GC for many PCC shows', website: 'freemanco.com', notes: 'Primary GC; union jurisdiction', union: 'Union' },
    ],
  },
  chicago: {
    'Exhibit Fabricators / Builders': [
      { name: 'Nimlok Chicago', specialty: 'Award-winning modular and custom booth building', website: 'nimlok-chicago.com', notes: 'Full-service exhibit house; McCormick specialist', union: 'Non-union' },
      { name: 'Sensations Exhibits', specialty: 'Custom exhibit builds, 23+ years, award-winning', website: 'sensationsexhibits.com', notes: 'Large production facility; full-service', union: 'Non-union' },
      { name: 'ProExhibits', specialty: 'Custom design, fabrication, installation', website: 'proexhibits.com', notes: 'Award-winning; McCormick Place experience', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Entourage X', specialty: 'Furniture, seating, counters, lounge pieces for trade shows', website: 'entouragex.com', notes: 'Chicago trade show rental specialist', union: 'Non-union' },
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture', website: 'exponents.com', notes: 'National network; McCormick coverage', union: 'Non-union' },
      { name: 'Modern Event Rentals', specialty: 'LED furniture, display lighting, specialty rentals', website: 'moderneventrental.com', notes: 'Popular for trade show activations', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Dye Mansion', specialty: 'Large-format printing, trade show displays', website: 'dyemansion.com', notes: 'Chicago print specialist', union: 'Non-union' },
      { name: 'SpeedPro Chicago', specialty: 'Banners, booth graphics, vinyl wraps', website: 'speedpro.com', notes: 'National franchise; Chicago locations', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'GES', specialty: 'Official GC — McCormick Place', website: 'ges.com', notes: 'Largest GC at McCormick; all union trades', union: 'Union (Carpenters/Electricians/Teamsters/Riggers)' },
      { name: 'TRU Service Group', specialty: 'Professional I&D crews since 2010', website: 'truservicegroup.com', notes: 'McCormick specialist; union-coordinated', union: 'Union' },
      { name: 'Complete Crewing Inc.', specialty: 'Registered for all McCormick union locals', website: 'completecrewing.com', notes: 'All union jurisdictions covered', union: 'Union-signatory' },
    ],
  },
  kansas_city: {
    'Exhibit Fabricators / Builders': [
      { name: 'Cardinal Expo', specialty: 'Custom design, production, graphics, logistics', website: 'cardinalexpo.com', notes: 'Full-service exhibit house; national reach', union: 'Non-union' },
      { name: 'Vivid Exhibits', specialty: 'Custom and rental trade show displays', website: 'vividexhibits.com', notes: 'All services including local labor', union: 'Non-union' },
      { name: 'Iconic Displays', specialty: 'Hardware, lighting, flooring, furniture, I&D', website: 'iconicdisplays.com', notes: 'Full-service provider; Kansas City presence', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture nationwide', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
      { name: 'Swisstrax', specialty: 'Modular interlocking flooring tiles', website: 'swisstrax.com', notes: '18 colors, custom logos; quick setup', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Trabon Group', specialty: 'Large format, trade show displays, signs', website: 'trabongroup.com', notes: 'Almost 50 years experience; Kansas City-based', union: 'Non-union' },
      { name: 'SpeedPro North Kansas City', specialty: 'Large format, vinyl banners, trade show graphics', website: 'speedpro.com', notes: 'National franchise', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Liberty Exposition Services', specialty: 'General service contractor for Kansas City shows', website: 'libertyexpo.com', notes: 'KCCC specialist; professional crews', union: 'Mixed' },
      { name: 'Fern', specialty: 'National GC; 200+ cities including Kansas City', website: 'fernexpo.com', notes: 'National coverage; coast-to-coast', union: 'Union at major venues' },
    ],
  },
  dallas: {
    'Exhibit Fabricators / Builders': [
      { name: 'ProExhibits', specialty: 'Custom design, fabrication, installation — award-winning', website: 'proexhibits.com', notes: 'Full-service; Dallas and national shows', union: 'Non-union' },
      { name: 'Foster Display Group', specialty: 'Top 50 fabricator; design, fabrication, shipping, I&D', website: 'buildwithfoster.com', notes: 'One-roof operation; established builder', union: 'Non-union' },
      { name: 'TrueBlue Exhibits', specialty: 'KBH Convention Center rentals and custom builds', website: 'trueblue-exhibits.com', notes: 'Dallas specialist', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture, flooring', website: 'exponents.com', notes: 'National coverage with Dallas capability', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture rentals', website: 'cortevents.com', notes: 'Dallas stock available', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'SpeedPro Dallas', specialty: 'Booth graphics, banners, step-and-repeat, vinyl', website: 'speedpro.com/dallas', notes: 'Fast turnaround; national franchise', union: 'Non-union' },
      { name: 'Positive Marketing USA', specialty: 'Vinyl & mesh banners, trade show displays', website: 'positivemarketingusa.com', notes: 'Dallas-based printer', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'All Exhibit', specialty: 'Statewide TX service — Dallas, Austin, Houston', website: 'allexhibit.com', notes: 'Non-union; flexible crew options', union: 'Non-union' },
      { name: 'Shepard Exposition Services', specialty: 'Official GC for many Dallas shows', website: 'shepardexpo.com', notes: 'National GC; KBH Convention Center presence', union: 'Union at major venues' },
    ],
  },
  houston: {
    'Exhibit Fabricators / Builders': [
      { name: 'Exhibit House Houston', specialty: 'Custom exhibit design, fabrication, turnkey solutions', website: 'exhibithousehouston.com', notes: 'Houston-based full-service builder', union: 'Non-union' },
      { name: 'South Star Exhibits', specialty: 'Custom exhibits, fabrication, full services', website: 'southstarexhibits.com', notes: 'Full-service Houston exhibit company', union: 'Non-union' },
      { name: 'Metro Exhibits', specialty: 'Booth rentals, custom exhibits, I&D', website: 'metroexhibits.com', notes: 'George R. Brown CC primary provider', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Vibrant Rental', specialty: 'FastDeck 2.0 event flooring, furniture rentals', website: 'vibrantrental.com', notes: 'Advanced trade show flooring systems', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'SpeedPro Houston', specialty: 'Large format, banners, trade show graphics', website: 'speedpro.com', notes: 'National franchise; fast turnaround', union: 'Non-union' },
      { name: 'Printing for Less Houston', specialty: 'Custom banners, signage, trade show prints', website: 'printingforless.com', notes: 'Houston area large-format specialist', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Shepard Exposition Services', specialty: 'Official GC at George R. Brown CC', website: 'shepardexpo.com', notes: 'Primary GC at GRB; national coverage', union: 'Union at GRB' },
      { name: '21st Century Expo Group', specialty: 'Exclusive dock services at GRB', website: '21stcenturyexpo.com', notes: 'Drayage and dock specialist at GRB', union: 'Non-union' },
    ],
  },
  austin: {
    'Exhibit Fabricators / Builders': [
      { name: 'Trade Show Displays of Austin', specialty: 'Custom builds, modular rentals, AV, logistics', website: 'tradeshowdisplayaustin.com', notes: 'Austin CC specialist; certified EAC; full-service', union: 'Non-union' },
      { name: 'Foster Display Group', specialty: 'Design, fabrication, shipping, install, dismantle', website: 'buildwithfoster.com', notes: 'Top 50 fabricator; serves Austin market', union: 'Non-union' },
      { name: 'Austin Art Services', specialty: 'Exhibit design, fabrication, logistics', website: 'austinartservices.com', notes: 'Local Austin builder', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exhibit Experience', specialty: 'Booth rentals, furniture, flooring — certified EAC', website: 'exhibitexperience.com', notes: 'Affordable rentals; extensive inventory', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture rentals', website: 'cortevents.com', notes: 'National coverage', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'ProGraphix Austin', specialty: 'Large format, banners, event branding, vehicle wraps', website: 'pgaustin.com', notes: '25+ years; SXSW & ACL specialist', union: 'Non-union' },
      { name: 'Austin Sign Co.', specialty: 'Vinyl signage, trade show displays', website: 'austinsignco.com', notes: 'Festival and event specialist', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Trade Show Displays of Austin', specialty: 'Certified labor leads, riggers, technicians', website: 'tradeshowdisplayaustin.com', notes: 'Full I&D; Austin CC and local venues', union: 'Non-union' },
      { name: 'All Exhibit', specialty: 'Statewide TX service — Dallas, Austin, Houston', website: 'allexhibit.com', notes: 'Non-union; flexible options', union: 'Non-union' },
    ],
  },
  miami: {
    'Exhibit Fabricators / Builders': [
      { name: 'Sensations Worldwide', specialty: '22+ years, award-winning custom booth builder', website: 'sensationsworldwide.com', notes: '5700+ sqm production facilities; full-service', union: 'Non-union' },
      { name: 'Connect Exhibit', specialty: 'High-quality custom booth design & build', website: 'connectexhibit.com', notes: 'Miami and South Florida specialist', union: 'Non-union' },
      { name: 'Exhibit nStands Builder USA', specialty: 'Turnkey exhibit services; 4+ decades experience', website: 'exhibitnstandsbuilder.us', notes: 'Design, construction, shipping, install, dismantle', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Vista South Convention Services', specialty: 'Furniture, material handling, flooring rentals', website: 'vistasouthcs.com', notes: 'Miami/MBCC specialist; general exposition contractor', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture nationwide', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'SpeedPro Miami', specialty: 'Large format, vinyl banners, trade show graphics', website: 'speedpro.com', notes: 'National franchise; Miami location', union: 'Non-union' },
      { name: 'Print Palace Miami', specialty: 'Custom banners, backlit displays, floor graphics', website: 'printpalacemiami.com', notes: 'Miami trade show print specialist', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Expo Convention Contractors Inc.', specialty: 'Full-service production, install/dismantle', website: 'expocci.com', notes: "Florida's full-service GC; MBCC specialist", union: 'Union (IATSE/IBEW at MBCC)' },
      { name: 'Freeman', specialty: 'Official GC for many Miami shows', website: 'freemanco.com', notes: 'National GC; union labor where required', union: 'Union at MBCC' },
    ],
  },
  atlanta: {
    'Exhibit Fabricators / Builders': [
      { name: 'Atlanta Trade Show Exhibits', specialty: 'Turnkey: design, fabrication, install, dismantle', website: 'atlantatradeshowexhibits.com', notes: 'Atlanta specialist; GWCC expertise', union: 'Non-union' },
      { name: 'Expo Creators', specialty: 'Exhibition stand design, fabrication, setup', website: 'expocreators.com', notes: 'Atlanta-based full-service builder', union: 'Non-union' },
      { name: 'Metro Exhibits', specialty: 'Custom exhibits, booth rentals, I&D', website: 'metroexhibits.com', notes: 'Full-service provider; GWCC experience', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture, flooring', website: 'exponents.com', notes: 'National network; Atlanta coverage', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Wallace Graphics', specialty: 'Trade show graphics, signs, vinyl banners', website: 'wallacegraphics.com', notes: 'Atlanta trade show specialist', union: 'Non-union' },
      { name: 'SpeedPro Greater Atlanta', specialty: 'Portable exhibits, banners, step-and-repeat', website: 'speedpro.com', notes: 'National franchise; Atlanta locations', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'GES', specialty: 'Official GC — Georgia World Congress Center', website: 'ges.com', notes: 'Open shop at GWCC; non-union labor available', union: 'Non-union (GWCC is open shop)' },
      { name: 'Freeman', specialty: 'GC for selected Atlanta shows', website: 'freemanco.com', notes: 'National GC; Atlanta presence', union: 'Non-union at GWCC' },
    ],
  },
  los_angeles: {
    'Exhibit Fabricators / Builders': [
      { name: 'Blueprint Exhibits', specialty: 'Custom booth design, fabrication, rentals', website: 'blueprintexhibits.com', notes: 'Industry leader in LA; full-service', union: 'Non-union' },
      { name: 'Sensations Worldwide', specialty: '22+ years, award-winning booth builder', website: 'sensationsworldwide.com', notes: 'LA production & warehouse; full-service', union: 'Non-union' },
      { name: 'RCS Custom Exhibits', specialty: 'Custom booth design, builders, full service', website: 'rcscustomexhibits.com', notes: 'LA-based custom exhibit house', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture, flooring', website: 'exponents.com', notes: '30,000 sqft San Diego facility; LA delivery', union: 'Non-union' },
      { name: 'RG Event Surfaces', specialty: 'Portable, customizable trade show flooring', website: 'rgeventsurfaces.com', notes: 'LA flooring specialist', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Image Square Printing', specialty: 'Large format, movie studios, conferences, trade shows', website: 'imagesquareprinting.com', notes: '20+ years experience; LA specialist', union: 'Non-union' },
      { name: 'Platon Graphics', specialty: 'Corporate murals, custom banners, building wraps', website: 'platongraphics.com', notes: 'Large format specialist; LA/national', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Freeman', specialty: 'Official GC — LA Convention Center', website: 'freemanco.com', notes: 'Primary GC at LACC; IATSE Local 831 required', union: 'Union (IATSE Local 831, Teamsters Local 986)' },
      { name: 'GES', specialty: 'GC for LA area shows', website: 'ges.com', notes: 'National GC; alternate to Freeman at some shows', union: 'Union' },
    ],
  },
  seattle: {
    'Exhibit Fabricators / Builders': [
      { name: 'Expo Stand Services', specialty: 'Design, construction, fabrication, shipping, I&D', website: 'expostandservice.com', notes: '18+ years; comprehensive full-service', union: 'Non-union' },
      { name: 'Exponents', specialty: 'Custom and rental exhibit builds', website: 'exponents.com', notes: 'National coverage with Seattle capability', union: 'Non-union' },
      { name: 'American Image Displays', specialty: 'Trade show exhibits, banners, booth I&D', website: 'american-image.com', notes: 'Seattle-based exhibit specialist', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture nationwide', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture', website: 'exponents.com', notes: 'Includes flooring and furniture packages', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Signs of Seattle', specialty: 'Custom banners, trade show booths, retail displays', website: 'signsofseattle.com', notes: 'Cutting-edge large format; Seattle specialist', union: 'Non-union' },
      { name: 'Seattle Design and Print', specialty: 'Trade show graphics, vehicle wraps, banners', website: 'seattledesignandprint.com', notes: '25+ years experience', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Freeman', specialty: 'Official GC — Washington State Convention Center', website: 'freemanco.com', notes: 'Primary GC at WSCC; union jurisdiction', union: 'Union (Carpenters/IBEW Local 46/IATSE Local 15/Teamsters)' },
      { name: 'GES', specialty: 'GC for Seattle area shows', website: 'ges.com', notes: 'National GC; alternate at some Seattle shows', union: 'Union at WSCC' },
    ],
  },
  san_francisco: {
    'Exhibit Fabricators / Builders': [
      { name: 'Arena Exhibits', specialty: 'Custom design & fabrication; in-house CNC & wood shop', website: 'arenaexhibits.com', notes: 'Independent since 1997; Mission District, SF; high quality', union: 'Non-union' },
      { name: 'Blueprint Exhibits', specialty: 'All-inclusive booth design, fabrication, rentals', website: 'blueprintexhibits.com', notes: 'SD production facility; serves SF/Bay Area shows', union: 'Non-union' },
      { name: 'Sensations Worldwide', specialty: '21+ years, award-winning booth builder', website: 'sensationsworldwide.com', notes: 'Bay Area warehouse and production', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'Exponents', specialty: 'Booth rentals, modular systems, furniture, flooring', website: 'exponents.com', notes: 'Large Bay Area warehouse; Moscone specialist', union: 'Non-union' },
      { name: 'Exhibit Experience', specialty: 'Furniture, flooring, affordable rentals', website: 'exhibitexperience.com', notes: 'Certified EAC; extensive inventory', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'Dynamite Digital', specialty: 'Event venue graphics, large format, Moscone specialist', website: 'dynamitedigital.com', notes: 'SF trade show print expert', union: 'Non-union' },
      { name: 'San Francisco Banner', specialty: 'Custom vinyl banners, retractable banner stands', website: 'sanfranciscobanner.com', notes: 'Indoor & outdoor trade show displays', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Freeman', specialty: 'Official GC — Moscone Center', website: 'freemanco.com', notes: 'Primary GC at Moscone; Teamsters + IATSE required', union: 'Union (IATSE Local 16, Teamsters Local 65, IBEW Local 6)' },
      { name: 'Pure Exhibits', specialty: 'EAC; union labor coordination, Teamsters scheduling', website: 'purexhibits.com', notes: 'Every March at Moscone; union-experienced EAC', union: 'Union-coordinated EAC' },
    ],
  },
  usa: {
    'Exhibit Fabricators / Builders': [
      { name: 'Exponents', specialty: 'Nationwide booth rental and custom builds', website: 'exponents.com', notes: '30,000 sqft production; 97% in-house; nationwide install', union: 'Non-union' },
      { name: 'Cardinal Expo', specialty: 'Full-service exhibit management, national', website: 'cardinalexpo.com', notes: 'Repairs, custom solutions, nationwide', union: 'Non-union' },
      { name: 'Sensations Worldwide', specialty: '22+ years, award-winning; production facilities nationwide', website: 'sensationsworldwide.com', notes: 'National reach; multiple production sites', union: 'Non-union' },
    ],
    'Rental Companies': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture — national specialist', website: 'afrtradeshow.com', notes: 'Nationwide trade show furniture specialist', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture, nationwide', website: 'cortevents.com', notes: 'National coverage', union: 'Non-union' },
    ],
    'Graphics / Print Shops': [
      { name: 'SpeedPro', specialty: 'Large format printing — national franchise network', website: 'speedpro.com', notes: 'Locations in most major US cities; consistent quality', union: 'Non-union' },
      { name: 'Signs.com', specialty: 'Online large-format printing; national shipping', website: 'signs.com', notes: 'Fast online ordering; nationwide delivery', union: 'Non-union' },
    ],
    'General Contractors / I&D Labor': [
      { name: 'Freeman', specialty: 'Largest US trade show GC; national coverage', website: 'freemanco.com', notes: 'Primary GC at most major US convention centers', union: 'Union at major venues' },
      { name: 'GES', specialty: 'National GC; alternative to Freeman at many shows', website: 'ges.com', notes: 'National trade show services', union: 'Union at major venues' },
      { name: 'Fern', specialty: 'National GC; 200+ cities', website: 'fernexpo.com', notes: 'Coast-to-coast coverage', union: 'Union at major venues' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Claude API call to refresh vendor data for a given city
// ---------------------------------------------------------------------------
async function refreshCityVendors(city, env) {
  const cityLabel = city.replace(/_/g, ' ');
  const prompt = `You are a trade show industry expert. Research and provide current recommended vendors for trade show booth services in ${cityLabel} (USA/Canada).

These vendors should be LOCAL companies in ${cityLabel} that can execute a complete trade show booth project: design, custom fabrication, installation, dismantle, and logistics. They are alternatives to a Toronto-based exhibit house for projects happening in ${cityLabel}.

Return a JSON object with this exact structure:
{
  "Exhibit Fabricators / Builders": [{"name": "...", "specialty": "...", "website": "...", "notes": "...", "union": "Union|Non-union|Mixed"}],
  "Rental Companies": [...],
  "Graphics / Print Shops": [...],
  "General Contractors / I&D Labor": [...]
}

Requirements:
- 2-3 vendors per category
- Established companies (5+ years in business)
- Focus on companies that can work with outside clients (not exclusive house contractors)
- Include union affiliation status
- "Exhibit Fabricators / Builders" should be full-service custom exhibit houses, NOT just labor crews
- "Rental Companies" should provide modular display systems, furniture, flooring, AV rentals
- "General Contractors / I&D Labor" should be assembly/dismantle crews or official show GCs

Return ONLY valid JSON. No markdown, no explanation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  let text = data.content?.[0]?.text?.trim() || '';
  if (text.startsWith('```json')) text = text.slice(7);
  if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scheduled handler — runs on cron trigger (every 3 months)
// ---------------------------------------------------------------------------
async function handleScheduled(env) {
  const cities = Object.keys(VENDOR_SEED);
  const updated = {};
  for (const city of cities) {
    const categories = await refreshCityVendors(city, env);
    updated[city] = {
      city,
      last_updated: new Date().toISOString(),
      categories: categories || VENDOR_SEED[city],
    };
    // Small delay between API calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  await env.VENDOR_KV.put('vendors:all', JSON.stringify(updated));
  await env.VENDOR_KV.put('vendors:last_updated', new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Fetch handler — serves vendor data via GET /vendors?city=xxx
// ---------------------------------------------------------------------------
async function handleFetch(request, env) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const authError = verifyAuth(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.pathname.endsWith('/vendors')) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const city = url.searchParams.get('city') || 'usa';

  try {
    // Try KV first
    const raw = await env.VENDOR_KV.get('vendors:all');
    if (raw) {
      const all = JSON.parse(raw);
      const cityData = all[city] || all['usa'];
      return new Response(JSON.stringify(cityData), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
      });
    }
  } catch {
    // Fall through to seed
  }

  // Fallback: serve seed data
  const seedCity = VENDOR_SEED[city] || VENDOR_SEED['usa'];
  const fallback = { city, last_updated: null, categories: seedCity };
  return new Response(JSON.stringify(fallback), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  });
}

// ---------------------------------------------------------------------------
// Worker entry points
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    try {
      return await handleFetch(request, env);
    } catch (err) {
      return new Response(JSON.stringify({ error: sanitizeError(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event, env) {
    await handleScheduled(env);
  }
};
