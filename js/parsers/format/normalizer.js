/**
 * parsers/format/normalizer.js
 * ──────────────────────────────────────────────────────────────────
 * Single entry point that routes any detected format to the correct
 * parser and returns a normalized rows[].
 *
 * Depends on:
 *   format-detector.js
 *   parsers/format/spreadsheet.js
 *   parsers/format/text-formats.js
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Normalize text input into an array of row objects.
 *
 * @param {string} text      — raw input text
 * @param {string} [filename=''] — optional filename for extension detection
 * @returns {{ rows: Object[], formatUsed: string }}
 */
function normalizeText(text, filename = '') {
  const fmt = detectFormat(text, filename);
  const rows = _parseByFormat(text, fmt);
  return { rows, formatUsed: fmt };
}

/**
 * Normalize a binary file (ArrayBuffer) — for XLSX / XLS / ODS.
 *
 * @param {ArrayBuffer} buffer
 * @returns {{ rows: Object[], formatUsed: string }}
 */
function normalizeBinary(buffer) {
  const rows = parseBinarySpreadsheet(buffer);
  return { rows, formatUsed: 'spreadsheet' };
}

/**
 * Route text to the correct parser.
 * @param {string} text
 * @param {string} fmt
 * @returns {Object[]}
 */
function _parseByFormat(text, fmt) {
  switch (fmt) {
    case 'json':       return parseJSONFormat(text);
    case 'xml':        return parseXMLFormat(text);
    case 'html-table': return parseHTMLTableFormat(text);
    case 'markdown':   return parseMarkdownFormat(text);
    case 'tsv':        return parseTextSpreadsheet(text, 'tsv');
    case 'csv':        return parseTextSpreadsheet(text, 'csv');
    case 'tabular':    return parseTabularFormat(text);
    default:           return parseTextSpreadsheet(text, 'csv');
  }
}

/**
 * Human-readable label for a format string.
 * @param {string} fmt
 * @returns {string}
 */
function formatLabel(fmt) {
  const MAP = {
    json:         'JSON',
    xml:          'XML',
    'html-table': 'HTML-Tabelle',
    markdown:     'Markdown',
    tsv:          'TSV',
    csv:          'CSV',
    spreadsheet:  'Spreadsheet',
    tabular:      'Tabellarisch',
    unknown:      'Unbekannt',
  };
  return MAP[fmt] ?? fmt.toUpperCase();
}
