/**
 * parsers/format/spreadsheet.js
 * ──────────────────────────────────────────────────────────────────
 * Converts CSV, TSV, XLSX, XLS and ODS inputs into row objects.
 * Uses SheetJS (XLSX global) for all formats.
 *
 * For text-based formats (CSV/TSV) SheetJS handles UTF-8 correctly
 * when the input is passed as a string with type:'string'.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Parse a CSV or TSV string into row objects.
 * SheetJS is used so that UTF-8 Umlauts and quoted fields
 * are handled correctly regardless of origin.
 *
 * @param {string} text        — raw UTF-8 text
 * @param {'csv'|'tsv'} fmt
 * @returns {Object[]}
 */
function parseTextSpreadsheet(text, fmt = 'csv') {
  if (typeof XLSX === 'undefined') {
    // Fallback: use built-in CSV parser if SheetJS is not yet loaded
    return _fallbackCSV(text);
  }

  const delim = (fmt === 'tsv' || text.charAt(0) !== text.charAt(0).replace('\t', ''))
    ? '\t'
    : _sniffDelimiter(text);

  const wb = XLSX.read(text, { type: 'string', raw: false, FS: delim });
  return _sheetToRows(wb.Sheets[wb.SheetNames[0]]);
}

/**
 * Parse a binary ArrayBuffer (XLSX, XLS, ODS) into row objects.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Object[]}
 */
function parseBinarySpreadsheet(buffer) {
  if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) ist nicht geladen.');
  const wb = XLSX.read(buffer, { type: 'array' });
  return _sheetToRows(wb.Sheets[wb.SheetNames[0]]);
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Convert the first sheet of a workbook to row objects,
 * coercing booleans.
 * @param {Object} ws — SheetJS worksheet
 * @returns {Object[]}
 */
function _sheetToRows(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  return raw.map(row => {
    const out = {};
    Object.entries(row).forEach(([k, v]) => {
      out[k.trim()] = _coerceCell(v);
    });
    return out;
  });
}

/**
 * Coerce a cell value: booleans → native bool, rest → trimmed string.
 * @param {any} v
 * @returns {boolean|string}
 */
function _coerceCell(v) {
  const s = String(v ?? '').trim();
  const lo = s.toLowerCase();
  if (lo === 'true' || lo === 'wahr')   return true;
  if (lo === 'false' || lo === 'falsch') return false;
  return s;
}

/**
 * Sniff the most likely CSV delimiter.
 * @param {string} text
 * @returns {string}
 */
function _sniffDelimiter(text) {
  const line = text.split('\n').find(l => l.trim()) || '';
  const tabs  = (line.match(/\t/g)  || []).length;
  const semis = (line.match(/;/g)   || []).length;
  const commas= (line.match(/,/g)   || []).length;
  if (tabs  > 0) return '\t';
  if (semis > 0) return ';';
  if (commas> 0) return ',';
  return ',';
}

/**
 * Minimal CSV fallback — used if SheetJS is unavailable.
 * Handles quoted fields with embedded commas.
 * @param {string} text
 * @returns {Object[]}
 */
function _fallbackCSV(text) {
  const delim = _sniffDelimiter(text);
  const lines  = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('Keine Datenzeilen nach dem Parsen gefunden.');

  const headers = _splitCSVLine(lines[0], delim).map(h => h.trim());

  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cells = _splitCSVLine(line, delim);
      const row   = {};
      headers.forEach((h, i) => { row[h] = _coerceCell(cells[i] ?? ''); });
      return row;
    });
}

/**
 * Split a single CSV line into cells, respecting quoted fields.
 * @param {string} line
 * @param {string} delim
 * @returns {string[]}
 */
function _splitCSVLine(line, delim) {
  const cells = [];
  let cur = '', inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQ)  { inQ = true; continue; }
    if (ch === '"' &&  inQ)  {
      if (line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = false;
      continue;
    }
    if (ch === delim && !inQ) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}
