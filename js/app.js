/**
 * app.js
 * ──────────────────────────────────────────────────────────────────
 * Application entry point.
 * Renders ImportPanels, wires up options + generate + output.
 *
 * Load order (enforced in index.html):
 *   icons.js → utils.js → validator.js →
 *   parsers/csv-base.js → parsers/nomen.js → parsers/verb.js →
 *   parsers/adjektiv.js → parsers/simple.js →
 *   import-panel.js → ui.js → app.js
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/* ================================================================
   APPLICATION STATE
   ================================================================ */

/** @type {string} last generated output string */
let _outputString = '';

/**
 * Map of wortart key → ImportPanel instance.
 * @type {Map<string, { el: Element, getEntries: Function, clear: Function }>}
 */
const _panels = new Map();


/* ================================================================
   INIT
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  

  
  _renderImportPanels();
  _bindOptions();
  _bindGenerateBtn();
  _bindOutputActions();

  // hinzugefügt: Vorschau-Callbacks und Event-Listener initialisieren
  initPreviewCallbacks({
    onDelete(wortart, key) {
      const panel = _panels.get(wortart);
      if (panel && panel.removeEntry(key)) {
        showToast(`"${key}" gelöscht`);
        _refreshAfterEdit();
      }
    },
    onUpdate(wortart, key, updatedEntry) {
      const panel = _panels.get(wortart);
      if (panel && panel.updateEntry(key, updatedEntry)) {
        _refreshAfterEdit();
      }
    },
  });
  initPreviewEvents();
});


/* ================================================================
   THEME TOGGLE
   ================================================================ */

function _bindThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  toggle.addEventListener('click', toggleTheme);
  toggle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTheme(); }
  });
}


/* ================================================================
   IMPORT PANELS — render all 6 into #importPanels container
   ================================================================ */

function _renderImportPanels() {
  const container = document.getElementById('importPanels');
  if (!container) return;

  WORTARTEN.forEach(config => {
    const panel = createImportPanel(config, {
      onImport: _handleImport,
    });
    _panels.set(config.key, panel);
    container.appendChild(panel.el);
  });
}

/**
 * Called by each panel after a successful import.
 * @param {string} wortartKey
 * @param {{ key: string, entry: Object }[]} entries
 */
function _handleImport(wortartKey, entries) {
  const total = _getAllEntries().length;
  setGenerateEnabled(total > 0);
  showToast(`${entries.length} ${wortartKey}-Einträge importiert`);
}


/* ================================================================
   OPTIONS
   ================================================================ */

function _bindOptions() {
  const formatSelect = document.getElementById('outputFormat');
  const varNameGroup = document.getElementById('varNameGroup');

  if (formatSelect) {
    formatSelect.addEventListener('change', function () {
      const show = this.value !== 'json';
      if (varNameGroup) varNameGroup.style.display = show ? '' : 'none';
    });
  }

  // Live re-generate when options change (if output exists)
  ['outputFormat', 'varName', 'sortKeys'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (_outputString) _generate();
    });
  });
}


/* ================================================================
   GENERATE
   ================================================================ */

function _bindGenerateBtn() {
  document.getElementById('generateBtn')?.addEventListener('click', _generate);
}

/**
 * Merge all panel entries → build lexikon → render output.
 */
function _generate() {
  let entries = _getAllEntries();

  if (!entries.length) {
    showToast('Keine Einträge zum Generieren');
    return;
  }

  // Sort alphabetically (optional)
  const shouldSort = document.getElementById('sortKeys')?.checked;
  if (shouldSort) {
    entries = [...entries].sort((a, b) => a.key.localeCompare(b.key, 'de'));
  }

  // Build lexikon object — geändert: nach Wortart gruppiert
  //
  // Mapping: entry.wortart → Kategorie-Key im Output-Objekt
  const WORTART_TO_KEY = {
    'Nomen':       'nomen',
    'Verb':        'verben',
    'Adjektiv':    'adjektive',
    'Präposition': 'präpositionen',
    'Adverb':      'adverbien',
    'Partikel':    'partikel',
  };

  // geändert: feste Kategorien in definierter Reihenfolge vorinitialisieren
  const lexikon = {
    nomen:         {},
    verben:        {},
    adjektive:     {},
    präpositionen: {},
    adverbien:     {},
    partikel:      {},
  };

  entries.forEach(({ key, entry }) => {
    const wortart   = entry.wortart ?? '';
    // geändert: bekannte Wortart → fester Key; unbekannt → lowercase oder "unbekannt"
    const gruppeKey = WORTART_TO_KEY[wortart]
      ?? (wortart ? wortart.toLowerCase() : 'unbekannt');
    // geändert: dynamische Kategorie anlegen, falls Wortart nicht im Mapping
    if (!lexikon[gruppeKey]) lexikon[gruppeKey] = {};
    lexikon[gruppeKey][key] = entry;
  });

  // Validate
  renderValidation(validateLexikon(entries));

  // Serialise
  const raw = JSON.stringify(lexikon, null, 2);
  const format  = document.getElementById('outputFormat')?.value || 'json';
  const varName = (document.getElementById('varName')?.value || 'LEXIKON').trim();

  if (format === 'json') {
    _outputString = raw;
  } else if (format === 'const') {
    _outputString = `const ${varName} = ${raw};`;
  } else {
    _outputString = `export default ${raw};`;
  }

  // geändert: gruppierte Vorschau statt flacher Tabelle
  renderPreviewGrouped(entries);
  showOutput(_outputString);
}

/**
 * Collect entries from all panels.
 * @returns {{ key: string, entry: Object }[]}
 */
function _getAllEntries() {
  const all = [];
  _panels.forEach(panel => all.push(...panel.getEntries()));
  return all;
}

/**
 * Nach einer Inline-Edit oder Delete-Aktion: Vorschau + Output-Counter aktualisieren.
 * Wenn bereits Output vorhanden, neu generieren.
 * // hinzugefügt
 */
function _refreshAfterEdit() {
  const entries = _getAllEntries();
  setGenerateEnabled(entries.length > 0);
  if (entries.length) {
    renderPreviewGrouped(entries);
    if (_outputString) _generate();
  } else {
    resetOutput();
  }
}


/* ================================================================
   OUTPUT ACTIONS
   ================================================================ */

function _bindOutputActions() {
  document.getElementById('copyBtn')?.addEventListener('click', () => {
    copyToClipboard(_outputString, document.getElementById('copyBtn'));
  });

  document.getElementById('downloadOutputBtn')?.addEventListener('click', () => {
    if (!_outputString) return;
    const format  = document.getElementById('outputFormat')?.value || 'json';
    const varName = (document.getElementById('varName')?.value || 'lexikon').trim();
    const ext     = format === 'json' ? 'json' : 'js';
    const name    = varName.toLowerCase().replace(/\s+/g, '_');
    triggerDownload(_outputString, `${name}.${ext}`);
  });
}
