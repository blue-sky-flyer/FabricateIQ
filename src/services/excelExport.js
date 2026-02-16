import ExcelJS from 'exceljs';

// Color palette
const C = {
  darkBg: 'FF2C2C2E', white: 'FFFFFFFF', lightGray: 'FFF5F5F7',
  lightBlue: 'FFE3F2FD', medGray: 'FF86868B', primaryDark: 'FF1D1D1F',
  yellowBg: 'FFFFFBEB', yellowText: 'FF92400E',
  greenBg: 'FFE8F5E9', green: 'FF34C759',
  orangeBg: 'FFFFF3E0', orange: 'FFFF9500',
  redBg: 'FFFFEBEE', red: 'FFFF3B30',
  gridLine: 'FFE0E0E0'
};

const CURRENCY_FORMAT = '"$"#,##0.00';
const THIN_BORDER = { style: 'thin', color: { argb: C.gridLine } };
const MED_BORDER = { style: 'medium' };

function fillSolid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function applyGridBorders(row, cols) {
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  }
}

function writeSectionHeader(ws, r, text) {
  ws.mergeCells(r, 1, r, 8);
  const cell = ws.getCell(r, 1);
  cell.value = text;
  cell.font = { bold: true, size: 12, color: { argb: C.white } };
  cell.fill = fillSolid(C.darkBg);
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = { top: MED_BORDER, bottom: MED_BORDER, left: MED_BORDER, right: MED_BORDER };
  ws.getRow(r).height = 24;
}

function writeSubtotalRow(ws, r, label, amount) {
  const row = ws.getRow(r);
  row.getCell(1).value = label;
  row.getCell(1).font = { bold: true, size: 11 };
  row.getCell(2).value = amount;
  row.getCell(2).numFmt = CURRENCY_FORMAT;
  row.getCell(2).font = { bold: true, size: 11 };
  for (let c = 1; c <= 8; c++) {
    row.getCell(c).fill = fillSolid(C.lightGray);
    row.getCell(c).border = { top: MED_BORDER, bottom: MED_BORDER };
  }
}

function writeConfidence(cell, conf) {
  const lc = (conf || '').toLowerCase();
  cell.value = lc.toUpperCase();
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.font = { bold: true, size: 9, color: { argb: lc === 'high' ? C.green : lc === 'medium' ? C.orange : lc === 'low' ? C.red : C.medGray } };
  if (lc === 'high') cell.fill = fillSolid(C.greenBg);
  else if (lc === 'medium') cell.fill = fillSolid(C.orangeBg);
  else if (lc === 'low') cell.fill = fillSolid(C.redBg);
}

/**
 * Add title + metadata rows. Returns next row number.
 */
function addHeaderSection(ws, startRow, quote, displaySpecs, currency) {
  let r = startRow;

  // Title
  ws.mergeCells(r, 1, r, 8);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = 'FabricateIQ Quote';
  titleCell.font = { bold: true, size: 18, color: { argb: C.primaryDark } };
  titleCell.fill = fillSolid(C.lightGray);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 36;
  r++;

  // Metadata row
  ws.getCell(r, 1).value = 'Generated';
  ws.getCell(r, 1).font = { color: { argb: C.medGray } };
  ws.getCell(r, 2).value = new Date().toLocaleDateString();
  ws.getCell(r, 3).value = 'Currency';
  ws.getCell(r, 3).font = { color: { argb: C.medGray } };
  ws.getCell(r, 4).value = currency;
  ws.getCell(r, 4).font = { bold: true };
  ws.getCell(r, 5).value = 'Confidence';
  ws.getCell(r, 5).font = { color: { argb: C.medGray } };
  writeConfidence(ws.getCell(r, 6), quote.confidence);
  r++;

  // Event name
  if (displaySpecs.event) {
    ws.getCell(r, 1).value = displaySpecs.event;
    ws.getCell(r, 1).font = { italic: true, size: 11, color: { argb: C.medGray } };
    r++;
  }

  r++; // separator

  // Booth specifications
  writeSectionHeader(ws, r, 'BOOTH SPECIFICATIONS');
  r++;

  const specRows = [
    ['Dimensions', displaySpecs.dimensions],
    ['Square Footage', displaySpecs.sqft],
    ['Location', displaySpecs.location],
    ['Duration', displaySpecs.duration]
  ];

  specRows.forEach((spec, i) => {
    ws.getCell(r, 1).value = spec[0];
    ws.getCell(r, 1).font = { bold: true, size: 11 };
    ws.getCell(r, 2).value = spec[1];
    ws.getCell(r, 2).font = { size: 11 };
    if (i % 2 === 0) {
      ws.getCell(r, 1).fill = fillSolid(C.lightGray);
      ws.getCell(r, 2).fill = fillSolid(C.lightGray);
    }
    applyGridBorders(ws.getRow(r), 2);
    r++;
  });

  return r + 1; // +1 for separator
}

/**
 * Add materials breakdown rows. Returns next row number and the header row for freeze panes.
 */
function addMaterialsSection(ws, startRow, materials) {
  let r = startRow;

  writeSectionHeader(ws, r, 'MATERIALS BREAKDOWN');
  r++;

  const headers = ['Category', 'Amount', 'Item', 'Qty', 'Dimensions', 'Unit Price', 'Extended', 'Confidence'];
  const headerRow = r;
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: C.primaryDark } };
    cell.fill = fillSolid(C.lightBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: MED_BORDER, top: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  });
  r++;

  const categories = [
    { key: 'walls', label: 'Walls/Fabrication', liKey: 'walls_line_items' },
    { key: 'flooring', label: 'Flooring', liKey: 'flooring_line_items' },
    { key: 'graphics', label: 'Graphics', liKey: 'graphics_line_items' },
    { key: 'av_lighting', label: 'AV/Lighting', liKey: 'av_lighting_line_items' },
    { key: 'furniture', label: 'Furniture', liKey: 'furniture_line_items' },
    { key: 'other', label: 'Other', liKey: 'other_line_items' }
  ];

  for (const cat of categories) {
    const amt = materials?.[cat.key] || 0;
    if (amt <= 0) continue;

    const catRow = ws.getRow(r);
    catRow.getCell(1).value = cat.label;
    catRow.getCell(1).font = { bold: true, size: 11 };
    catRow.getCell(2).value = amt;
    catRow.getCell(2).numFmt = CURRENCY_FORMAT;
    catRow.getCell(2).font = { bold: true, size: 11 };
    catRow.getCell(2).alignment = { horizontal: 'right' };
    for (let c = 1; c <= 8; c++) {
      catRow.getCell(c).fill = fillSolid(C.lightBlue);
      catRow.getCell(c).border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
    }
    r++;

    for (const li of (materials?.[cat.liKey] || [])) {
      const liRow = ws.getRow(r);
      liRow.getCell(3).value = li.item || '';
      liRow.getCell(4).value = li.qty || '';
      liRow.getCell(5).value = li.dimensions || '';
      liRow.getCell(6).value = li.unit_price || '';
      if (li.extended) {
        liRow.getCell(7).value = parseFloat(li.extended) || 0;
        liRow.getCell(7).numFmt = CURRENCY_FORMAT;
        liRow.getCell(7).alignment = { horizontal: 'right' };
      }
      if (li.confidence) writeConfidence(liRow.getCell(8), li.confidence);
      applyGridBorders(liRow, 8);
      r++;
    }
  }

  writeSubtotalRow(ws, r, 'Materials Subtotal', materials?.subtotal || 0);
  r++;

  return { nextRow: r + 1, headerRow };
}

/**
 * Add services breakdown rows. Returns next row number.
 */
function addServicesSection(ws, startRow, services) {
  let r = startRow;

  writeSectionHeader(ws, r, 'SERVICES BREAKDOWN');
  r++;

  ['Service', 'Amount', 'Rate', 'Note/Detail'].forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: C.primaryDark } };
    cell.fill = fillSolid(C.lightBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: MED_BORDER, top: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  });
  r++;

  const svcCategories = [
    { label: 'Design/PM', amtKey: 'design_pm', pctKey: 'design_pm_percent', noteKey: 'design_pm_note', liKey: null },
    { label: 'Install/Dismantle', amtKey: 'install_dismantle', pctKey: 'install_dismantle_percent', noteKey: null, liKey: 'install_dismantle_line_items' },
    { label: 'Logistics', amtKey: 'logistics', pctKey: 'logistics_percent', noteKey: null, liKey: 'logistics_line_items' },
    { label: 'Storage', amtKey: 'storage', pctKey: null, noteKey: null, liKey: 'storage_line_items' }
  ];

  for (const svc of svcCategories) {
    const amt = services?.[svc.amtKey] || 0;
    if (amt <= 0) continue;

    const svcRow = ws.getRow(r);
    svcRow.getCell(1).value = svc.label;
    svcRow.getCell(1).font = { bold: true, size: 11 };
    svcRow.getCell(2).value = amt;
    svcRow.getCell(2).numFmt = CURRENCY_FORMAT;
    svcRow.getCell(2).alignment = { horizontal: 'right' };
    const pct = svc.pctKey ? services?.[svc.pctKey] : null;
    if (pct) svcRow.getCell(3).value = `${pct}%`;
    const note = svc.noteKey ? services?.[svc.noteKey] : null;
    if (note) {
      svcRow.getCell(4).value = note;
      svcRow.getCell(4).font = { size: 10, color: { argb: C.medGray } };
    }
    applyGridBorders(svcRow, 4);
    r++;

    if (svc.liKey) {
      for (const li of (services?.[svc.liKey] || [])) {
        const liRow = ws.getRow(r);
        liRow.getCell(3).value = li.dimensions ? `${li.item || ''} (${li.dimensions})` : (li.item || '');
        liRow.getCell(4).value = li.qty || '';
        if (li.extended) {
          liRow.getCell(2).value = parseFloat(li.extended) || 0;
          liRow.getCell(2).numFmt = CURRENCY_FORMAT;
          liRow.getCell(2).alignment = { horizontal: 'right' };
        }
        applyGridBorders(liRow, 4);
        r++;
      }
    }
  }

  writeSubtotalRow(ws, r, 'Services Subtotal', services?.subtotal || 0);
  r++;

  return r + 1;
}

/**
 * Add totals, tax, and notes. Returns next row number.
 */
function addSummarySection(ws, startRow, quote) {
  let r = startRow;

  // Contingency
  if (quote.contingency > 0) {
    const row = ws.getRow(r);
    row.getCell(1).value = 'Contingency';
    row.getCell(1).font = { size: 11 };
    row.getCell(2).value = quote.contingency;
    row.getCell(2).numFmt = CURRENCY_FORMAT;
    row.getCell(2).alignment = { horizontal: 'right' };
    applyGridBorders(row, 2);
    r++;
  }

  // Subtotal before tax
  const stRow = ws.getRow(r);
  stRow.getCell(1).value = 'Subtotal before tax';
  stRow.getCell(1).font = { bold: true, size: 11 };
  stRow.getCell(2).value = quote.subtotal_before_tax || 0;
  stRow.getCell(2).numFmt = CURRENCY_FORMAT;
  stRow.getCell(2).font = { bold: true, size: 11 };
  stRow.getCell(2).alignment = { horizontal: 'right' };
  for (let c = 1; c <= 8; c++) stRow.getCell(c).border = { top: THIN_BORDER };
  r++;

  // Tax
  const taxRow = ws.getRow(r);
  taxRow.getCell(1).value = `Tax (${((quote.tax_rate || 0) * 100).toFixed(2)}%)`;
  taxRow.getCell(1).font = { size: 11 };
  taxRow.getCell(2).value = quote.tax_amount || 0;
  taxRow.getCell(2).numFmt = CURRENCY_FORMAT;
  taxRow.getCell(2).alignment = { horizontal: 'right' };
  applyGridBorders(taxRow, 2);
  r++;

  // TOTAL
  const totalRow = ws.getRow(r);
  totalRow.height = 35;
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true, size: 16, color: { argb: C.white } };
  totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  totalRow.getCell(2).value = quote.total || 0;
  totalRow.getCell(2).numFmt = CURRENCY_FORMAT;
  totalRow.getCell(2).font = { bold: true, size: 16, color: { argb: C.white } };
  totalRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
  for (let c = 1; c <= 8; c++) {
    totalRow.getCell(c).fill = fillSolid(C.darkBg);
    totalRow.getCell(c).border = { top: { style: 'thick' }, bottom: { style: 'thick' }, left: { style: 'thick' }, right: { style: 'thick' } };
  }
  r++;

  // Notes
  if (quote.notes?.length > 0) {
    r++;
    writeSectionHeader(ws, r, 'NOTES & ASSUMPTIONS');
    ws.getCell(r, 1).font = { bold: true, size: 11, color: { argb: C.yellowText } };
    ws.getCell(r, 1).fill = fillSolid(C.yellowBg);
    r++;

    for (const note of quote.notes) {
      ws.mergeCells(r, 1, r, 8);
      const noteCell = ws.getCell(r, 1);
      noteCell.value = `\u2022 ${note}`;
      noteCell.font = { size: 10, italic: true, color: { argb: C.yellowText } };
      noteCell.fill = fillSolid(C.yellowBg);
      noteCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      noteCell.border = { bottom: THIN_BORDER };
      ws.getRow(r).height = 22;
      r++;
    }
  }

  return r;
}

/**
 * Generate and download an Excel quote.
 */
export async function downloadQuote(quote, { width, length, location, duration, getCurrency }) {
  const specs = quote.booth_specs || {};
  const displaySpecs = {
    dimensions: specs.dimensions || `${width}ft x ${length}ft`,
    sqft: specs.square_footage || (parseFloat(width) * parseFloat(length)),
    location: specs.location || (location.charAt(0).toUpperCase() + location.slice(1)),
    event: specs.event_name || '',
    duration: specs.duration_days ? `${specs.duration_days} days` : `${duration} day${duration > 1 ? 's' : ''}`
  };
  const currency = getCurrency();

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Quote', {
    pageSetup: {
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      paperSize: 9, orientation: 'portrait',
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
    }
  });

  ws.columns = [
    { width: 20 }, { width: 16 }, { width: 35 }, { width: 8 },
    { width: 15 }, { width: 15 }, { width: 13 }, { width: 12 }
  ];

  let r = 1;
  r = addHeaderSection(ws, r, quote, displaySpecs, currency);
  const { nextRow, headerRow } = addMaterialsSection(ws, r, quote.materials);
  r = addServicesSection(ws, nextRow, quote.services);
  r = addSummarySection(ws, r, quote);

  ws.views = [{ state: 'frozen', ySplit: headerRow, xSplit: 0 }];
  ws.pageSetup.printArea = `A1:H${r - 1}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fabricateiq-quote-${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
