/**
 * parsers/format/text-formats.js
 * ──────────────────────────────────────────────────────────────────
 * Parsers for text-based formats:
 *   - JSON  (direct lexikon or array of row objects)
 *   - XML   (custom <lexikon> schema)
 *   - Markdown tables (GFM pipe syntax)
 *   - HTML <table> markup
 *   - Tabular (whitespace-separated, e.g. copy-paste from terminal)
 *
 * All return: Object[] (array of row objects with string/bool values)
 * Depends on: utils.js (str, parseBool)
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/* ================================================================
   JSON PARSER
   Accepts two shapes:
     1. Lexikon format: { "Wolf": { wortart, stamm, … } }
        → rows with `key` = the top-level key
     2. Array of row objects: [ { key, wortart, … }, … ]
   ================================================================ */

/**
 * @param {string} text
 * @returns {Object[]}
 */
function parseJSONFormat(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Ungültiges JSON: ${e.message}`);
  }

  // Shape 2: plain array
  if (Array.isArray(parsed)) {
    return parsed.map(r => _coerceRow(r));
  }

  // Shape 1: lexikon output — explode into rows
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed).map(([key, entry]) => {
      const row = { key };
      // Flatten nested structure back into flat row for wortart parsers
      if (entry.wortart)            row.wortart     = entry.wortart;
      if (entry.genus)              row.genus        = entry.genus;
      if (entry.position) {
        row.erst  = entry.position.erst;
        row.zweit = entry.position.zweit;
      }
      if (entry.stamm)              row.stamm        = entry.stamm;
      if (entry.formen) {
        Object.assign(row, entry.formen);
      }
      if (entry.fuge) {
        row.fuge_erst  = Array.isArray(entry.fuge.als_erst)
          ? entry.fuge.als_erst.join(',')
          : '';
        row.fuge_zweit = Array.isArray(entry.fuge.als_zweit)
          ? entry.fuge.als_zweit.join(',')
          : null;
      }
      return _coerceRow(row);
    });
  }

  throw new Error('JSON muss ein Objekt (Lexikon) oder ein Array von Einträgen sein.');
}

/** Coerce boolean fields in a plain row object. */
function _coerceRow(row) {
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    if (v === null || v === undefined) { out[k] = ''; return; }
    if (typeof v === 'boolean') { out[k] = v; return; }
    const s = String(v).trim();
    const lo = s.toLowerCase();
    if (lo === 'true' || lo === 'wahr')   { out[k] = true;  return; }
    if (lo === 'false' || lo === 'falsch'){ out[k] = false; return; }
    out[k] = s;
  });
  return out;
}


/* ================================================================
   XML PARSER
   Supported schema:
     <lexikon>
       <eintrag key="Wolf">
         <wortart>Nomen</wortart>
         <genus>maskulin</genus>
         <erst>true</erst>
         ...
       </eintrag>
     </lexikon>

   Also handles flat <row> or <entry> elements.
   ================================================================ */

/**
 * @param {string} text
 * @returns {Object[]}
 */
function parseXMLFormat(text) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml');
  } catch (e) {
    throw new Error(`XML-Parse-Fehler: ${e.message}`);
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Ungültiges XML: ${parseError.textContent.split('\n')[0]}`);
  }

  // Try <eintrag key="..."> structure
  const eintraege = doc.querySelectorAll('eintrag, entry, row');
  if (eintraege.length > 0) {
    return Array.from(eintraege).map(_xmlElementToRow);
  }

  // Try root children as entries (any tag name with child elements)
  const root = doc.documentElement;
  const children = Array.from(root.children).filter(el => el.children.length > 0);
  if (children.length > 0) {
    return children.map(_xmlElementToRow);
  }

  throw new Error('Keine Einträge im XML gefunden. Erwartetes Format: <lexikon><eintrag key="…">…</eintrag></lexikon>');
}

/**
 * Convert an XML element to a flat row object.
 * Reads: key attribute, then child element text content.
 * @param {Element} el
 * @returns {Object}
 */
function _xmlElementToRow(el) {
  const row = {};

  // key can be an attribute
  const keyAttr = el.getAttribute('key') || el.getAttribute('lemma') || el.getAttribute('id');
  if (keyAttr) row.key = keyAttr;

  // Each child element → field
  Array.from(el.children).forEach(child => {
    const name = child.tagName.toLowerCase();
    const val  = child.textContent.trim();
    row[name] = val;
  });

  return _coerceRow(row);
}


/* ================================================================
   MARKDOWN TABLE PARSER
   GFM pipe syntax:
     | key | wortart | … |
     |-----|---------|---|
     | Wolf | Nomen | … |
   ================================================================ */

/**
 * @param {string} text
 * @returns {Object[]}
 */
function parseMarkdownFormat(text) {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const tableLines = lines.filter(l => l.startsWith('|'));
  if (tableLines.length < 2) {
    throw new Error('Keine Markdown-Tabelle gefunden. Erwartet: | Spalte | … |');
  }

  // Find header line (first pipe line that is not a separator)
  const isSeparator = l => /^\|[\s\-:|]+\|$/.test(l);
  const headerLine = tableLines.find(l => !isSeparator(l));
  if (!headerLine) throw new Error('Markdown-Tabelle hat keine Kopfzeile.');

  const headers = _splitMdRow(headerLine);
  const rows    = tableLines
    .filter(l => l !== headerLine && !isSeparator(l))
    .map(line => {
      const cells = _splitMdRow(line);
      const row   = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      return _coerceRow(row);
    });

  if (!rows.length) throw new Error('Markdown-Tabelle enthält keine Datenzeilen.');
  return rows;
}

/**
 * Split a Markdown table row into cells.
 * Strips leading/trailing `|` and whitespace.
 * @param {string} line
 * @returns {string[]}
 */
function _splitMdRow(line) {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(c => c.trim());
}


/* ================================================================
   HTML TABLE PARSER
   Accepts any HTML containing a <table>.
   Uses DOMParser for correct handling of entities.
   ================================================================ */

/**
 * @param {string} text
 * @returns {Object[]}
 */
function parseHTMLTableFormat(text) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'text/html');
  } catch (e) {
    throw new Error(`HTML-Parse-Fehler: ${e.message}`);
  }

  const table = doc.querySelector('table');
  if (!table) throw new Error('Keine <table> im HTML gefunden.');

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 2) throw new Error('Tabelle hat keine Datenzeilen.');

  // First row = headers (th or td)
  const headers = Array.from(rows[0].querySelectorAll('th, td'))
    .map(cell => cell.textContent.trim().toLowerCase());

  if (!headers.length) throw new Error('Tabelle hat keine Kopfzeile.');

  return rows.slice(1).map(row => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    const obj   = {};
    headers.forEach((h, i) => { obj[h] = cells[i]?.textContent.trim() ?? ''; });
    return _coerceRow(obj);
  }).filter(r => Object.values(r).some(v => v !== '' && v !== null));
}


/* ================================================================
   TABULAR (WHITESPACE-SEPARATED) PARSER
   Handles copy-paste from spreadsheets where columns are separated
   by 2+ spaces or consistent whitespace patterns.
   Falls back to single-space split if nothing else matches.
   ================================================================ */

/**
 * @param {string} text
 * @returns {Object[]}
 */
function parseTabularFormat(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Mindestens zwei Zeilen erforderlich (Kopfzeile + Daten).');

  // Split strategy: prefer 2+ spaces (fixed-width columns)
  const splitLine = l => {
    if (l.includes('\t'))     return l.split('\t').map(c => c.trim());
    if (/  +/.test(l))        return l.split(/\s{2,}/).map(c => c.trim());
    return l.trim().split(/\s+/);
  };

  const headers = splitLine(lines[0]);
  if (!headers.length) throw new Error('Keine Kopfzeile erkennbar.');

  return lines.slice(1)
    .map(line => {
      const cells = splitLine(line);
      const row   = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      return _coerceRow(row);
    })
    .filter(r => Object.values(r).some(v => v !== ''));
}
