/**
 * format-detector.js
 * ──────────────────────────────────────────────────────────────────
 * Detects input format from file extension or text content.
 *
 * Supported formats:
 *   'json'              — JSON object or array
 *   'xml'               — XML/HTML-like markup with lexikon entries
 *   'html-table'        — HTML <table> markup
 *   'markdown'          — Markdown pipe-table (GFM)
 *   'csv'               — Comma-separated values (also semicolon)
 *   'tsv'               — Tab-separated values
 *   'tabular'           — Whitespace-separated (copy-paste fallback)
 *   'spreadsheet'       — Binary: XLSX, XLS, ODS (needs ArrayBuffer)
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/** File extensions → format string */
const EXT_MAP = {
  xlsx: 'spreadsheet',
  xls:  'spreadsheet',
  ods:  'spreadsheet',
  csv:  'csv',
  tsv:  'tsv',
  txt:  'auto',       // detect by content
  json: 'json',
  xml:  'xml',
  htm:  'html-table',
  html: 'html-table',
  md:   'markdown',
};

/**
 * Detect format from a filename (by extension).
 * Returns null if unknown — caller should fall back to content detection.
 *
 * @param {string} filename
 * @returns {string|null}
 */
function detectFormatByExtension(filename) {
  if (!filename) return null;
  const ext = filename.trim().split('.').pop().toLowerCase();
  return EXT_MAP[ext] ?? null;
}

/**
 * Detect format from text content.
 * Used for paste input and .txt files.
 *
 * @param {string} text
 * @returns {string}
 */
function detectFormatByContent(text) {
  const t = text.trim();
  if (!t) return 'unknown';

  // JSON: starts with { or [
  if (t.charAt(0) === '{' || t.charAt(0) === '[') return 'json';

  // XML: starts with <?xml or a tag resembling a lexikon root
  if (/^<\?xml/i.test(t) || /^<lexikon/i.test(t) || /^<eintraege/i.test(t)) return 'xml';

  // HTML table: contains <table or <tr
  if (/<table[\s>]/i.test(t) || /<tr[\s>]/i.test(t)) return 'html-table';

  // Markdown table: lines start with | and contain a separator line ---
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
  const hasPipeLines = lines.filter(l => l.startsWith('|') && l.endsWith('|')).length >= 2;
  const hasSeparator = lines.some(l => /^\|[\s\-:|]+\|$/.test(l));
  if (hasPipeLines && hasSeparator) return 'markdown';

  // TSV: first data line has at least one tab
  const firstLine = lines[0] || '';
  if (firstLine.includes('\t')) return 'tsv';

  // CSV: semicolons beat commas in ambiguous cases (European locale)
  if (firstLine.includes(';')) return 'csv';
  if (firstLine.includes(',')) return 'csv';

  // Fallback: assume whitespace-separated tabular data
  return 'tabular';
}

/**
 * Full detection: prefer extension, fall back to content.
 *
 * @param {string}  text
 * @param {string}  [filename='']
 * @returns {string}
 */
function detectFormat(text, filename = '') {
  const byExt = detectFormatByExtension(filename);
  if (byExt && byExt !== 'auto') return byExt;
  return detectFormatByContent(text);
}
