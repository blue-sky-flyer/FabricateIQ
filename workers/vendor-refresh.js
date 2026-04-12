/**
 * FabricateIQ Vendor Refresh Worker
 *
 * Handles two responsibilities:
 * 1. Scheduled cron (every 3 months): refreshes vendor data in KV by calling Claude API
 * 2. GET /vendors?city=<location_key>: returns vendor data for a city (from KV or seed)
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
    'I&D Contractors': [
      { name: 'PTNR Production Inc', specialty: 'Full-service exhibit fabrication & I&D', website: 'ptnrproduction.com', notes: 'Primary vendor — Toronto home base', union: 'Non-union' },
      { name: 'Nimlok Toronto', specialty: 'Modular exhibit installation', website: 'nimlok.ca', notes: 'Established exhibit house', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Derse', specialty: 'Custom exhibit design & build', website: 'derse.com', notes: 'Full lifecycle exhibit management', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Pixel Graphics', specialty: 'Large-format printing, SEG fabric', website: 'pixelgraphics.ca', notes: 'Trade show specialist', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'Freeman AV Canada', specialty: 'AV rentals, LED walls, staging', website: 'freemanco.com', notes: 'National provider', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture nationwide', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
    ],
  },
  montreal: {
    'I&D Contractors': [
      { name: 'CoMotion Exhibits', specialty: 'Full-service design, fabrication, installation', website: 'comotioneventsinc.com', notes: 'Serves Toronto, Montreal, Vancouver', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Evo Exhibits', specialty: 'Custom exhibits, modular systems', website: 'evoexhibits.com', notes: 'Montreal-based builder', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Transcontinental Printing', specialty: 'Large-format printing', website: 'transcontinental.com', notes: 'National print provider', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'Freeman AV Canada', specialty: 'AV rentals, LED walls', website: 'freemanco.com', notes: 'National provider', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
    ],
  },
  vancouver: {
    'I&D Contractors': [
      { name: 'Whistler Show Services', specialty: 'Installation & dismantle labor, Vancouver CC', website: 'whistlershowservices.com', notes: 'Official EAC at VCC', union: 'Union (BC Building Trades)' },
      { name: 'CoMotion Exhibits', specialty: 'Full-service exhibits, fabrication', website: 'comotioneventsinc.com', notes: 'Serves Vancouver, Toronto, Montreal', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Müller Expo', specialty: 'Custom booth design, fabrication, installation', website: 'mullerexpo.com', notes: 'Production facility in Vancouver', union: 'Non-union' },
      { name: 'Beaumont Exhibits', specialty: 'Turnkey exhibit solutions', website: 'beaumontandco.ca', notes: '20+ years experience', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'SpeedPro Vancouver', specialty: 'Large-format printing, trade show graphics', website: 'speedpro.com', notes: 'National franchise, fast turnaround', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'Freeman AV Canada', specialty: 'AV rentals, LED walls, staging', website: 'freemanco.com', notes: 'Serves Vancouver CC', union: 'Union' },
    ],
    'Furniture Rental': [
      { name: 'Courtney Agencies', specialty: 'Customs, freight, drayage — VCC specialist', website: 'courtney.ca', notes: '65+ years, cross-border logistics', union: 'Union-affiliated' },
    ],
  },
  new_york: {
    'I&D Contractors': [
      { name: 'Expo Event Services', specialty: 'Labor, furniture, freight handling, on-site mgmt', website: 'expoeventservices.com', notes: 'Javits Center specialist', union: 'Union (Teamsters/Carpenters/IBEW)' },
      { name: 'Freeman', specialty: 'Official general contractor — Javits Center', website: 'freemanco.com', notes: 'Exclusive material handling at many shows', union: 'Union' },
    ],
    'Exhibit Houses': [
      { name: 'Zumizo International', specialty: 'Custom trade show booths, 2 decades NYC', website: 'zumizointernational.com', notes: 'Full design-to-install service', union: 'Non-union' },
      { name: 'Iconic Displays', specialty: 'Display systems, rentals, I&D', website: 'iconicdisplays.com', notes: 'Multiple NYC area offices', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Mega Format NYC', specialty: 'Trade show banners, vinyl, large format', website: 'megaformat.net', notes: 'Brooklyn location; wide material options', union: 'Non-union' },
      { name: 'Color X', specialty: 'Large format, custom fabrication, floor graphics', website: 'color-x.com', notes: 'Retail & trade show displays', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'GSE Audio Visual', specialty: 'LED walls, projectors, lighting & truss', website: 'gseav.com', notes: '500+ trade shows annually', union: 'Union at Javits' },
    ],
    'Furniture Rental': [
      { name: 'CORT Events', specialty: 'Event furniture, nationwide', website: 'cortevents.com', notes: 'National coverage with NY stock', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
  },
  boston: {
    'I&D Contractors': [
      { name: 'Exponents', specialty: 'Full on-site support, AV setup, union coordination', website: 'exponents.com', notes: 'BCEC and Hynes CC specialist', union: 'Union (Carpenters/IATSE)' },
      { name: 'Iconic Displays', specialty: 'Thousands of Boston venue installations', website: 'iconicdisplays.com', notes: 'Established Boston presence', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Cardinal Expo', specialty: 'Custom booth rental, fabrication, installation', website: 'cardinalexpo.com', notes: 'Full-service exhibit house', union: 'Non-union' },
      { name: 'Müller Expo', specialty: 'Design, fabrication, installation, warehouse', website: 'mullerexpo.com', notes: 'National coverage', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'ICL Imaging', specialty: 'SEG fabric, tension fabric, rigid graphics', website: 'icl-imaging.com', notes: 'First in New England for fabric banner printing', union: 'Non-union' },
      { name: 'SpeedPro Boston Metrowest', specialty: 'Trade show & retail graphics', website: 'speedpro.com', notes: 'Fast turnaround', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound, touchscreens', website: 'avrexpos.com', notes: 'BCEC, Hynes expertise', union: 'Union at BCEC' },
      { name: 'Aria AV', specialty: 'Full-service AV, 24/7 support', website: 'ariaav.com', notes: 'Corporate events specialist', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture nationwide', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture', website: 'cortevents.com', notes: 'National provider', union: 'Non-union' },
    ],
  },
  philadelphia: {
    'I&D Contractors': [
      { name: 'Pennsylvania Convention Center Exhibitor Services', specialty: 'Official labor coordination', website: 'paconvention.com', notes: 'Contact: 215-418-2190; exhibitorservices@paconvention.com', union: 'Union (Carpenters/Teamsters/IBEW/IATSE)' },
      { name: 'Exponents', specialty: 'Turnkey booth services, I&D', website: 'exponents.com', notes: 'National coverage', union: 'Non-union (EAC)' },
    ],
    'Exhibit Houses': [
      { name: 'Metro Exhibits', specialty: 'Full-service exhibits, Philadelphia', website: 'metroexhibits.com', notes: 'PCC specialist', union: 'Non-union' },
      { name: 'Airborne Visuals', specialty: 'Display systems, raised flooring', website: 'airbornevisuals.com', notes: 'ARES-X flooring specialty', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Color Reflections', specialty: 'Event branding, convention banners', website: 'colorreflections.com', notes: 'Convention & retail display expertise', union: 'Non-union' },
      { name: 'PDC Graphics', specialty: 'Booth backdrops, banner stands, hanging signs', website: 'pdcgraphics.com', notes: 'PCC exhibitor-focused', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'GSE Audio Visual', specialty: 'LED, projectors, audio, lighting & truss', website: 'gseav.com', notes: 'One of largest US rental providers', union: 'Union at PCC' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
    ],
  },
  chicago: {
    'I&D Contractors': [
      { name: 'TRU Service Group', specialty: 'Professional I&D since 2010', website: 'truservicegroup.com', notes: 'McCormick Place specialist', union: 'Union (all McCormick trades)' },
      { name: 'Complete Crewing Inc.', specialty: 'Union-signatory contractor, all local unions', website: 'completecrewing.com', notes: 'Registered for all McCormick Place union locals', union: 'Union' },
      { name: 'ProExhibits', specialty: 'I&D with Chicago union crew expertise', website: 'proexhibits.com', notes: 'Extensive McCormick Place experience', union: 'Non-union (EAC)' },
    ],
    'Exhibit Houses': [
      { name: 'Nimlok Chicago', specialty: 'Award-winning modular booth building', website: 'nimlok-chicago.com', notes: 'Full-service exhibit house', union: 'Non-union' },
      { name: 'Sensations Exhibits', specialty: '23+ years, award-winning booth builder', website: 'sensationsexhibits.com', notes: 'Production facility; 5700+ sqm', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'SpeedPro Chicago', specialty: 'Large format printing, vinyl banners', website: 'speedpro.com', notes: 'National franchise, Chicago locations', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'Freeman AV', specialty: 'Official AV at many McCormick shows', website: 'freemanco.com', notes: 'Largest US tradeshow AV provider', union: 'Union at McCormick' },
      { name: 'GSE Audio Visual', specialty: 'LED, projectors, audio, truss', website: 'gseav.com', notes: '500+ shows annually', union: 'Union at McCormick' },
    ],
    'Furniture Rental': [
      { name: 'Entourage X', specialty: 'Furniture, seating, counters, lounge pieces', website: 'entouragex.com', notes: 'Chicago trade show specialist', union: 'Non-union' },
      { name: 'Modern Event Rentals', specialty: 'LED furniture, light-up tables, bars', website: 'moderneventrental.com', notes: 'Popular for trade show activations', union: 'Non-union' },
    ],
  },
  kansas_city: {
    'I&D Contractors': [
      { name: 'Liberty Exposition Services', specialty: 'Professional trade show solutions', website: 'libertyexpo.com', notes: 'Kansas City general service contractor', union: 'Mixed' },
      { name: 'Fern', specialty: 'General contractor, 200+ cities', website: 'fernexpo.com', notes: 'National coast-to-coast coverage', union: 'Union at major venues' },
    ],
    'Exhibit Houses': [
      { name: 'Cardinal Expo', specialty: 'Custom design, production, graphics, logistics', website: 'cardinalexpo.com', notes: 'Full-service exhibit house', union: 'Non-union' },
      { name: 'Vivid Exhibits', specialty: 'Custom & rental displays', website: 'vividexhibits.com', notes: 'All services including local labor', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Trabon Group', specialty: 'Large format, trade show displays', website: 'trabongroup.com', notes: 'Almost 50 years experience', union: 'Non-union' },
      { name: 'SpeedPro North Kansas City', specialty: 'Large format, vinyl banners', website: 'speedpro.com', notes: 'National franchise', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound', website: 'avrexpos.com', notes: 'National trade show AV', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
      { name: 'Swisstrax', specialty: 'Modular interlocking flooring tiles', website: 'swisstrax.com', notes: '18 colors, custom logos', union: 'Non-union' },
    ],
  },
  dallas: {
    'I&D Contractors': [
      { name: 'All Exhibit', specialty: 'Statewide TX service — Dallas, Austin, Houston', website: 'allexhibit.com', notes: 'Non-union; flexible crew options', union: 'Non-union' },
      { name: 'Vivid Exhibits', specialty: 'Custom & rental booths with local labor', website: 'vividexhibits.com', notes: 'KBH Convention Center expertise', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'ProExhibits', specialty: 'Custom design, fabrication, installation', website: 'proexhibits.com', notes: 'Award-winning full-service', union: 'Non-union' },
      { name: 'TrueBlue Exhibits', specialty: 'KBH Convention Center rentals & design', website: 'trueblue-exhibits.com', notes: 'Dallas specialist', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'SpeedPro Dallas', specialty: 'Custom banners, booth graphics, vinyl', website: 'speedpro.com/dallas', notes: 'Fast turnaround, national franchise', union: 'Non-union' },
      { name: 'Positive Marketing USA', specialty: 'Vinyl & mesh banners, trade show displays', website: 'positivemarketingusa.com', notes: 'Dallas-based', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound, touchscreens', website: 'avrexpos.com', notes: 'National trade show AV', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'CORT Events', specialty: 'Event furniture, nationwide', website: 'cortevents.com', notes: 'National coverage', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
  },
  houston: {
    'I&D Contractors': [
      { name: 'Metro Exhibits', specialty: 'Booth rentals, custom exhibits, I&D', website: 'metroexhibits.com', notes: 'GRB Convention Center primary provider', union: 'Non-union' },
      { name: '21st Century Expo Group', specialty: 'Exclusive dock services at GRB', website: '21stcenturyexpo.com', notes: 'Drayage/dock specialist at GRB', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Exhibit House Houston', specialty: 'Custom exhibit design, fabrication, turnkey', website: 'exhibithousehouston.com', notes: 'Houston-based builder', union: 'Non-union' },
      { name: 'South Star Exhibits', specialty: 'Custom exhibits, fabrication, full services', website: 'southstarexhibits.com', notes: 'Full-service Houston company', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'SpeedPro Houston', specialty: 'Large format, banners, trade show graphics', website: 'speedpro.com', notes: 'National franchise, fast turnaround', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound — GRB & NRG', website: 'avrexpos.com', notes: 'George R. Brown & NRG Park specialist', union: 'Non-union' },
      { name: 'AB AV Rentals', specialty: 'LED walls, projectors, sound, staging, lighting', website: 'abavrentals.com', notes: 'Full-range AV', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'Vibrant Rental', specialty: 'FastDeck 2.0 event flooring system', website: 'vibrantrental.com', notes: 'Advanced trade show flooring', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
  },
  austin: {
    'I&D Contractors': [
      { name: 'Trade Show Displays of Austin', specialty: 'Certified labor, riggers, technicians', website: 'tradeshowdisplayaustin.com', notes: 'Austin CC specialist; East & North Austin ops', union: 'Non-union' },
      { name: 'Exhibit Experience', specialty: 'I&D services, efficient execution', website: 'exhibitexperience.com', notes: 'Certified EAC', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Foster Display Group', specialty: 'Design, fabrication, shipping, install, dismantle', website: 'buildwithfoster.com', notes: 'Top 50 fabrication company', union: 'Non-union' },
      { name: 'Austin Art Services', specialty: 'Exhibit design, fabrication, logistics', website: 'austinartservices.com', notes: 'Local Austin builder', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'ProGraphix Austin', specialty: 'Large format, banners, event branding', website: 'pgaustin.com', notes: '25+ years; SXSW & ACL experience', union: 'Non-union' },
      { name: 'Austin Sign Co.', specialty: 'Vinyl signage, trade show displays', website: 'austinsignco.com', notes: 'Festival & event specialist', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'Trade Show Displays of Austin', specialty: 'AV setup included in packages', website: 'tradeshowdisplayaustin.com', notes: 'Integrated service provider', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'CORT Events', specialty: 'Event furniture, nationwide', website: 'cortevents.com', notes: 'National coverage', union: 'Non-union' },
    ],
  },
  miami: {
    'I&D Contractors': [
      { name: 'Expo Convention Contractors Inc.', specialty: 'Full-service production, install/dismantle', website: 'expocci.com', notes: "Florida's full-service company; MBCC specialist", union: 'Union (IATSE/IBEW at MBCC)' },
      { name: 'Vista South Convention Services', specialty: 'Furniture, material handling, I&D labor, cleaning', website: 'vistasouthcs.com', notes: 'General exposition contractor', union: 'Non-union (EAC)' },
    ],
    'Exhibit Houses': [
      { name: 'Sensations Worldwide', specialty: '22+ years, award-winning booth builder', website: 'sensationsworldwide.com', notes: '5700+ sqm production facilities', union: 'Non-union' },
      { name: 'Connect Exhibit', specialty: 'High-quality booth design & build', website: 'connectexhibit.com', notes: 'Thousands of satisfied clients', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'SpeedPro Miami', specialty: 'Large format, vinyl banners, trade show', website: 'speedpro.com', notes: 'National franchise', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound, touchscreens', website: 'avrexpos.com', notes: 'MBCC and Miami area specialist', union: 'Union at MBCC' },
    ],
    'Furniture Rental': [
      { name: 'Vista South Convention Services', specialty: 'Complete furniture rental with labor', website: 'vistasouthcs.com', notes: 'Miami specialist', union: 'Non-union' },
      { name: 'So Cool Events', specialty: 'Display tables, counters, conference tables', website: 'socoolevents.com', notes: 'Event rental specialist', union: 'Non-union' },
    ],
  },
  atlanta: {
    'I&D Contractors': [
      { name: 'GES', specialty: 'General contractor — GWCC installation/signage/rigging', website: 'ges.com', notes: 'Official contractor at GWCC; open shop', union: 'Non-union (GWCC is open shop)' },
      { name: 'Atlanta Trade Show Exhibits', specialty: 'Turnkey: design, fabrication, install, dismantle', website: 'atlantatradeshowexhibits.com', notes: 'Atlanta specialist', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Metro Exhibits', specialty: 'Booth rentals, custom exhibits, I&D', website: 'metroexhibits.com', notes: 'Full-service provider', union: 'Non-union' },
      { name: 'Expo Creators', specialty: 'Design, fabrication, setup & dismantling', website: 'expocreators.com', notes: 'Atlanta exhibition stand specialist', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Wallace Graphics', specialty: 'Trade show graphics, signs, vinyl banners', website: 'wallacegraphics.com', notes: 'Atlanta trade show specialist', union: 'Non-union' },
      { name: 'SpeedPro Greater Atlanta', specialty: 'Portable exhibits, step-and-repeat, banners', website: 'speedpro.com', notes: 'National franchise', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound — GWCC', website: 'avrexpos.com', notes: 'GWCC and multiple Atlanta facilities', union: 'Non-union' },
      { name: 'SmartSource', specialty: 'GWCC, Cobb Galleria, AmericasMart specialist', website: 'thesmartsource.com', notes: 'Venue-specific AV expertise', union: 'Non-union' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
  },
  los_angeles: {
    'I&D Contractors': [
      { name: 'Freeman', specialty: 'General contractor — LACC material handling', website: 'freemanco.com', notes: 'Primary contractor at LACC; union labor required', union: 'Union (IATSE Local 831, Teamsters)' },
      { name: 'GES', specialty: 'General service contractor, LACC', website: 'ges.com', notes: 'Alternate GC at LA shows', union: 'Union' },
    ],
    'Exhibit Houses': [
      { name: 'Blueprint Exhibits', specialty: 'Trade show booth rental, custom exhibits', website: 'blueprintexhibits.com', notes: 'Industry leader in LA', union: 'Non-union' },
      { name: 'Sensations Worldwide', specialty: '22+ years, award-winning booth builder', website: 'sensationsworldwide.com', notes: 'LA production & warehouse', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Image Square Printing', specialty: 'Large format, movie studios, conferences, trade shows', website: 'imagesquareprinting.com', notes: '20+ years experience', union: 'Non-union' },
      { name: 'Platon Graphics', specialty: 'Corporate murals, custom banners, building wraps', website: 'platongraphics.com', notes: 'Large format specialist', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound — LACC', website: 'avrexpos.com', notes: 'Union coordination at LACC', union: 'Union at LACC' },
    ],
    'Furniture Rental': [
      { name: 'CORT Events', specialty: 'Event furniture, nationwide', website: 'cortevents.com', notes: 'LA stock available', union: 'Non-union' },
      { name: 'RG Event Surfaces', specialty: 'Portable, customizable trade show flooring', website: 'rgeventsurfaces.com', notes: 'LA flooring specialist', union: 'Non-union' },
    ],
  },
  seattle: {
    'I&D Contractors': [
      { name: 'Freeman', specialty: 'General contractor — WSCC', website: 'freemanco.com', notes: 'Primary GC at Washington State CC; union required', union: 'Union (Carpenters/IBEW/IATSE/Teamsters)' },
      { name: 'American Image Displays', specialty: 'Trade show exhibits, banners, I&D', website: 'american-image.com', notes: 'Seattle specialist', union: 'Non-union' },
    ],
    'Exhibit Houses': [
      { name: 'Expo Stand Services', specialty: 'Design, construction, fabrication, shipping, I&D', website: 'expostandservice.com', notes: '18+ years, comprehensive', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'Signs of Seattle', specialty: 'Custom banners, trade show booths, retail displays', website: 'signsofseattle.com', notes: 'Cutting-edge large format', union: 'Non-union' },
      { name: 'Seattle Design and Print', specialty: 'Custom banners, trade show graphics, vehicle wraps', website: 'seattledesignandprint.com', notes: '25+ years experience', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'Audio Visual Factory', specialty: 'Pacific Northwest AV, since 1979', website: 'avfactory.com', notes: 'Established local company, regional reputation', union: 'Non-union' },
      { name: 'SmartSource', specialty: 'Seattle CC, Meydenbauer Center specialist', website: 'thesmartsource.com', notes: 'Venue-specific partnerships', union: 'Union at WSCC' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture nationwide', website: 'afrtradeshow.com', notes: 'National coverage', union: 'Non-union' },
    ],
  },
  san_francisco: {
    'I&D Contractors': [
      { name: 'Pure Exhibits', specialty: 'Union labor coordination, Teamsters scheduling', website: 'purexhibits.com', notes: 'Present every March at Moscone; Teamsters required', union: 'Union (IATSE Local 16, Teamsters, IBEW Local 6)' },
      { name: 'Iconic Displays', specialty: 'Thousands of SF convention center installations', website: 'iconicdisplays.com', notes: 'Large Bay Area warehouse', union: 'Non-union (EAC)' },
    ],
    'Exhibit Houses': [
      { name: 'Arena Exhibits', specialty: 'Custom design & fabrication, in-house CNC', website: 'arenaexhibits.com', notes: 'Independent since 1997; Mission District', union: 'Non-union' },
      { name: 'Blueprint Exhibits', specialty: 'All-inclusive design, fabrication, rentals', website: 'blueprintexhibits.com', notes: 'San Diego production for SF shows', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'San Francisco Banner', specialty: 'Custom vinyl banners, retractable stands', website: 'sanfranciscobanner.com', notes: 'Indoor & outdoor trade show displays', union: 'Non-union' },
      { name: 'Dynamite Digital', specialty: 'Event venue graphics, corporate events', website: 'dynamitedigital.com', notes: 'Moscone specialist', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'GSE Audio Visual', specialty: 'LED, projectors, audio, lighting — 500+ shows/yr', website: 'gseav.com', notes: 'One of largest US rental providers', union: 'Union at Moscone' },
    ],
    'Furniture Rental': [
      { name: 'Exhibit Experience', specialty: 'Furniture, flooring, affordable rentals', website: 'exhibitexperience.com', notes: 'Extensive inventory; certified EAC', union: 'Non-union' },
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture', website: 'afrtradeshow.com', notes: 'National provider', union: 'Non-union' },
    ],
  },
  usa: {
    'I&D Contractors': [
      { name: 'Freeman', specialty: 'General contractor, national coverage', website: 'freemanco.com', notes: 'Largest US trade show services company', union: 'Union at major venues' },
      { name: 'GES', specialty: 'General contractor, national coverage', website: 'ges.com', notes: 'National trade show services', union: 'Union at major venues' },
    ],
    'Exhibit Houses': [
      { name: 'Exponents', specialty: 'Nationwide booth rental and I&D', website: 'exponents.com', notes: '30,000 sqft San Diego production; national install', union: 'Non-union' },
      { name: 'Cardinal Expo', specialty: 'Full-service exhibit management, national', website: 'cardinalexpo.com', notes: 'Repairs, adaptations, custom solutions', union: 'Non-union' },
    ],
    'Graphics / Print': [
      { name: 'SpeedPro', specialty: 'Large format printing, national franchise network', website: 'speedpro.com', notes: 'Locations in most major US cities', union: 'Non-union' },
    ],
    'AV / Lighting': [
      { name: 'AVR Expos', specialty: 'LED walls, projectors, sound — national', website: 'avrexpos.com', notes: 'National trade show AV coverage', union: 'Varies by venue' },
      { name: 'GSE Audio Visual', specialty: '500+ trade shows annually, national', website: 'gseav.com', notes: 'One of largest US AV rental providers', union: 'Varies by venue' },
    ],
    'Furniture Rental': [
      { name: 'AFR Trade Show Rentals', specialty: 'Trade show furniture, national', website: 'afrtradeshow.com', notes: 'Nationwide trade show furniture specialist', union: 'Non-union' },
      { name: 'CORT Events', specialty: 'Event furniture, nationwide', website: 'cortevents.com', notes: 'National coverage', union: 'Non-union' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Claude API call to refresh vendor data for a given city
// ---------------------------------------------------------------------------
async function refreshCityVendors(city, env) {
  const cityLabel = city.replace(/_/g, ' ');
  const prompt = `You are a trade show industry expert. Research and provide current recommended vendors for trade show booth services in ${cityLabel} (USA/Canada).

Return a JSON object with this exact structure:
{
  "I&D Contractors": [{"name": "...", "specialty": "...", "website": "...", "notes": "...", "union": "Union|Non-union|Mixed"}],
  "Exhibit Houses": [...],
  "Graphics / Print": [...],
  "AV / Lighting": [...],
  "Furniture Rental": [...]
}

Requirements:
- 2-3 vendors per category
- Companies that have been operating 5+ years
- Companies that work with outside exhibit companies (not exclusive house contractors only)
- Include union affiliation status for each vendor
- Focus on vendors serving trade shows and exhibits specifically

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
