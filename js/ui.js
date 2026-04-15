/**
 * ui.js
 * ──────────────────────────────────────────────────────────────────
 * DOM rendering helpers: output, preview, validation, theme, toast.
 * No business logic. Depends on: utils.js, icons.js
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/* ================================================================
   THEME
   ================================================================ */




/**
 * @param {'dark'|'light'} theme
 */


/* ================================================================
   PREVIEW — PER-WORTART GROUPED TABLES          // hinzugefügt
   ================================================================ */

/**
 * Spaltenkonfiguration je Wortart.
 * get(key, entry) → Anzeigewert
 * set(entry, val) → Wert zurückschreiben (undefined = nicht editierbar)
 * type: 'bool' → <select> statt <input>
 * // hinzugefügt
 */
const WORTART_PREVIEW_COLS = {
  Nomen: [
    { key: 'wort',      label: 'Wort',     get: (k,e) => k,                           editable: false },
    { key: 'genus',     label: 'Genus',    get: (k,e) => e.genus || '',               set: (e,v) => { e.genus = v; } },
    { key: 'stamm',     label: 'Stamm',    get: (k,e) => e.stamm || '',               set: (e,v) => { e.stamm = v; } },
    { key: 'nom_sg',    label: 'Singular', get: (k,e) => e.formen?.nom_sg || '',      set: (e,v) => { e.formen.nom_sg = v; } },
    { key: 'gen_sg',    label: 'Genitiv',  get: (k,e) => e.formen?.gen_sg || '',      set: (e,v) => { e.formen.gen_sg = v; } },
    { key: 'plural',    label: 'Plural',   get: (k,e) => e.formen?.plural || '',      set: (e,v) => { e.formen.plural = v; } },
  ],
  Verb: [
    { key: 'wort',      label: 'Infinitiv', get: (k,e) => k,                          editable: false },
    { key: 'stamm',     label: 'Stamm',     get: (k,e) => e.stamm || '',              set: (e,v) => { e.stamm = v; } },
    { key: 'infinitiv', label: 'Form',      get: (k,e) => e.formen?.infinitiv || '',  set: (e,v) => { e.formen.infinitiv = v; } },
    { key: 'erst',      label: 'Erst',      get: (k,e) => e.position?.erst,           set: (e,v) => { e.position.erst  = v === 'true'; }, type: 'bool' },
    { key: 'zweit',     label: 'Zweit',     get: (k,e) => e.position?.zweit,          set: (e,v) => { e.position.zweit = v === 'true'; }, type: 'bool' },
  ],
  Adjektiv: [
    { key: 'wort',       label: 'Wort',       get: (k,e) => k,                              editable: false },
    { key: 'stamm',      label: 'Stamm',      get: (k,e) => e.stamm || '',                  set: (e,v) => { e.stamm = v; } },
    { key: 'positiv',    label: 'Positiv',    get: (k,e) => e.formen?.positiv    || '',      set: (e,v) => { e.formen.positiv    = v; } },
    { key: 'komparativ', label: 'Komparativ', get: (k,e) => e.formen?.komparativ || '',      set: (e,v) => { e.formen.komparativ = v; } },
    { key: 'superlativ', label: 'Superlativ', get: (k,e) => e.formen?.superlativ || '',      set: (e,v) => { e.formen.superlativ = v; } },
    { key: 'erst',       label: 'Erst',       get: (k,e) => e.position?.erst,               set: (e,v) => { e.position.erst     = v === 'true'; }, type: 'bool' },
  ],
  Präposition: [
    { key: 'wort',      label: 'Wort',      get: (k,e) => k,                           editable: false },
    { key: 'stamm',     label: 'Stamm',     get: (k,e) => e.stamm || '',               set: (e,v) => { e.stamm = v; } },
    { key: 'grundform', label: 'Grundform', get: (k,e) => e.formen?.grundform || '',   set: (e,v) => { e.formen.grundform = v; } },
    { key: 'erst',      label: 'Erst',      get: (k,e) => e.position?.erst,            set: (e,v) => { e.position.erst  = v === 'true'; }, type: 'bool' },
    { key: 'zweit',     label: 'Zweit',     get: (k,e) => e.position?.zweit,           set: (e,v) => { e.position.zweit = v === 'true'; }, type: 'bool' },
  ],
  Adverb: [
    { key: 'wort',      label: 'Wort',      get: (k,e) => k,                           editable: false },
    { key: 'stamm',     label: 'Stamm',     get: (k,e) => e.stamm || '',               set: (e,v) => { e.stamm = v; } },
    { key: 'grundform', label: 'Grundform', get: (k,e) => e.formen?.grundform || '',   set: (e,v) => { e.formen.grundform = v; } },
    { key: 'erst',      label: 'Erst',      get: (k,e) => e.position?.erst,            set: (e,v) => { e.position.erst  = v === 'true'; }, type: 'bool' },
  ],
  Partikel: [
    { key: 'wort',      label: 'Wort',      get: (k,e) => k,                           editable: false },
    { key: 'stamm',     label: 'Stamm',     get: (k,e) => e.stamm || '',               set: (e,v) => { e.stamm = v; } },
    { key: 'grundform', label: 'Grundform', get: (k,e) => e.formen?.grundform || '',   set: (e,v) => { e.formen.grundform = v; } },
    { key: 'erst',      label: 'Erst',      get: (k,e) => e.position?.erst,            set: (e,v) => { e.position.erst  = v === 'true'; }, type: 'bool' },
  ],
};

/** Laufzeit-Lookup: entryKey → { wortart, entry } für Edit-Callbacks // hinzugefügt */
let _previewEntryMap = new Map();

/** Callbacks für Löschen und Aktualisieren — gesetzt via initPreviewCallbacks // hinzugefügt */
let _previewCallbacks = { onDelete: null, onUpdate: null };

/**
 * Setzt die Action-Callbacks für die Vorschau.
 * Wird von app.js aufgerufen.
 * // hinzugefügt
 * @param {{ onDelete: Function, onUpdate: Function }} callbacks
 */
function initPreviewCallbacks(callbacks) {
  _previewCallbacks = callbacks;
}

/**
 * Rendert eine einzelne View-Mode-Tabellenzeile.
 * // hinzugefügt
 * @param {string} wortart
 * @param {string} key
 * @param {Object} entry
 * @param {Array}  cols  — aus WORTART_PREVIEW_COLS
 * @returns {string} HTML
 */
function _renderViewRow(wortart, key, entry, cols) {
  let cells = '';
  cols.forEach(col => {
    const val = col.get(key, entry);
    if (col.type === 'bool') {
      cells += `<td data-field="${col.key}" class="preview-bool">` +
        (val ? `<span class="bool-true">${icon('check', 11)}</span>`
             : `<span class="bool-false" style="opacity:.35">—</span>`) +
        '</td>';
    } else {
      cells += `<td data-field="${col.key}">${val ? escHtml(String(val)) : '<span style="opacity:.3">—</span>'}</td>`;
    }
  });

  cells += `<td class="col-actions" data-field="actions">
    <button class="btn btn-ghost btn-xs preview-action-btn" data-action="edit"
            title="Eintrag bearbeiten">${icon('edit-2', 11)}</button>
    <button class="btn btn-ghost btn-xs preview-action-btn preview-delete-btn" data-action="delete"
            title="Eintrag löschen">${icon('trash-2', 11)}</button>
  </td>`;

  return `<tr data-wortart="${escHtml(wortart)}" data-key="${escHtml(key)}">${cells}</tr>`;
}

/**
 * Rendert eine vollständige Wortart-Sektion (Header + Tabelle).
 * // hinzugefügt
 * @param {string} wortart
 * @param {{ key: string, entry: Object }[]} entries
 * @returns {string} HTML
 */
function _renderWortartSection(wortart, entries) {
  if (!entries.length) return '';
  const cols = WORTART_PREVIEW_COLS[wortart] || WORTART_PREVIEW_COLS['Partikel'];

  const thead = '<thead><tr>' +
    cols.map(c => `<th>${escHtml(c.label)}</th>`).join('') +
    '<th class="col-actions-head">Aktionen</th>' +
    '</tr></thead>';

  const tbody = '<tbody>' +
    entries.map(({ key, entry }) => _renderViewRow(wortart, key, entry, cols)).join('') +
    '</tbody>';

  return `
    <div class="wortart-section" data-section="${escHtml(wortart)}">
      <div class="wortart-section-header">
        <span class="wortart-section-label">${escHtml(wortart)}</span>
        <span class="stat-pill stat-pill--active">${entries.length}</span>
      </div>
      <div class="preview-wrap">
        <table class="preview-table">${thead}${tbody}</table>
      </div>
    </div>`;
}

/**
 * Rendert alle Wortart-Sektionen in #previewBody.
 * Ersetzt renderPreview für die Hauptansicht.
 * // hinzugefügt
 * @param {{ key: string, entry: Object }[]} allEntries  — flache Liste aus allen Panels
 */
function renderPreviewGrouped(allEntries) {
  // Lookup-Map aktualisieren
  _previewEntryMap.clear();
  allEntries.forEach(({ key, entry }) => {
    _previewEntryMap.set(key, { wortart: entry.wortart, entry });
  });

  // Nach Wortart gruppieren (Reihenfolge aus WORTARTEN)
  const order   = ['Nomen', 'Verb', 'Adjektiv', 'Präposition', 'Adverb', 'Partikel'];
  const grouped = {};
  order.forEach(w => { grouped[w] = []; });
  allEntries.forEach(e => {
    const w = e.entry.wortart;
    if (!grouped[w]) grouped[w] = [];
    grouped[w].push(e);
  });

  const html = order
    .map(w => _renderWortartSection(w, grouped[w]))
    .join('');

  document.getElementById('previewBody').innerHTML = html;

  document.getElementById('rowCount').textContent =
    `${allEntries.length} Eintrag${allEntries.length !== 1 ? 'e' : ''}`;

  document.getElementById('previewCard').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
}

/**
 * Event-Delegation-Handler für alle Aktionen in der Vorschau.
 * // hinzugefügt
 */
function _handlePreviewAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const row = btn.closest('tr[data-key]');
  if (!row) return;

  const entryKey = row.dataset.key;
  const wortart  = row.dataset.wortart;
  const info     = _previewEntryMap.get(entryKey);
  if (!info) return;

  switch (btn.dataset.action) {
    case 'delete':
      if (_previewCallbacks.onDelete) _previewCallbacks.onDelete(wortart, entryKey);
      break;
    case 'edit':
      _enterEditMode(row, wortart, entryKey, info.entry);
      break;
    case 'save':
      _commitEdit(row, wortart, entryKey, info.entry);
      break;
    case 'cancel':
      _cancelEdit(row, wortart, entryKey, info.entry);
      break;
  }
}

/**
 * Schaltet eine Zeile in den Edit-Modus:
 * Textzellen → <input>, Bool-Zellen → <select>.
 * // hinzugefügt
 */
function _enterEditMode(row, wortart, entryKey, entry) {
  const cols = WORTART_PREVIEW_COLS[wortart] || [];
  cols.forEach(col => {
    if (col.editable === false) return;
    const cell = row.querySelector(`[data-field="${col.key}"]`);
    if (!cell) return;
    const val = col.get(entryKey, entry);
    if (col.type === 'bool') {
      cell.innerHTML =
        `<select class="cell-select" data-field-input="${col.key}">
          <option value="true"  ${val ? 'selected' : ''}>✓ ja</option>
          <option value="false" ${!val ? 'selected' : ''}>— nein</option>
        </select>`;
    } else {
      cell.innerHTML =
        `<input class="cell-input" data-field-input="${col.key}"
                value="${escHtml(String(val ?? ''))}" />`;
    }
  });

  // Aktionen-Spalte umschalten
  const actionCell = row.querySelector('[data-field="actions"]');
  if (actionCell) {
    actionCell.innerHTML =
      `<button class="btn btn-primary btn-xs preview-action-btn" data-action="save"
               title="Speichern">${icon('check', 11)}</button>
       <button class="btn btn-ghost btn-xs preview-action-btn" data-action="cancel"
               title="Abbrechen">${icon('x', 11)}</button>`;
  }

  row.classList.add('row-editing');
  row.querySelector('.cell-input, .cell-select')?.focus();
}

/**
 * Liest die Inputs aus, schreibt zurück ins Entry, ruft onUpdate.
 * // hinzugefügt
 */
function _commitEdit(row, wortart, entryKey, originalEntry) {
  const cols         = WORTART_PREVIEW_COLS[wortart] || [];
  const updatedEntry = JSON.parse(JSON.stringify(originalEntry));  // deep clone

  cols.forEach(col => {
    if (!col.set) return;
    const input = row.querySelector(`[data-field-input="${col.key}"]`);
    if (input) col.set(updatedEntry, input.value);
  });

  if (_previewCallbacks.onUpdate) _previewCallbacks.onUpdate(wortart, entryKey, updatedEntry);
}

/**
 * Edit abbrechen: Zeile zurück in den View-Modus rendern.
 * // hinzugefügt
 */
function _cancelEdit(row, wortart, entryKey, entry) {
  const cols    = WORTART_PREVIEW_COLS[wortart] || [];
  const newHtml = _renderViewRow(wortart, entryKey, entry, cols);
  row.outerHTML = newHtml;  // Event-Delegation greift auf neuen Node
}

/**
 * Initialisiert den Event-Listener auf #previewBody.
 * Muss nach DOMContentLoaded aufgerufen werden.
 * // hinzugefügt
 */
function initPreviewEvents() {
  document.getElementById('previewBody')
    ?.addEventListener('click', _handlePreviewAction);
}


/* ================================================================
   PREVIEW TABLE (alt — bleibt für Kompatibilität)
   ================================================================ */

/** Columns shown in the preview table — universal across wortarten. */
const PREVIEW_COLS = ['key', 'wortart', 'genus', 'stamm', 'erst', 'zweit', 'als_erst'];
const PREVIEW_MAX  = 10;

/**
 * Render merged lexikon entries into the preview table.
 * @param {{ key: string, entry: Object }[]} entries
 */
function renderPreview(entries) {
  const subset = entries.slice(0, PREVIEW_MAX);

  let html = '<thead><tr>' +
    PREVIEW_COLS.map(c => `<th>${escHtml(c)}</th>`).join('') +
    '</tr></thead><tbody>';

  subset.forEach(({ key, entry }) => {
    html += '<tr>';
    PREVIEW_COLS.forEach(col => {
      if (col === 'key') {
        html += `<td class="col-key">${escHtml(key)}</td>`;
      } else if (col === 'erst' || col === 'zweit') {
        const b = entry.position?.[col];
        html += `<td class="${b ? 'bool-true' : 'bool-false'}">${b ? icon('check', 12) : '—'}</td>`;
      } else if (col === 'als_erst') {
        const v = entry.fuge?.als_erst;
        const txt = Array.isArray(v) ? v.map(s => s === '' ? '∅' : s).join(' | ') : '—';
        html += `<td style="font-family:var(--font-mono);font-size:11px;">${escHtml(txt)}</td>`;
      } else if (col === 'genus') {
        const v = entry.genus || '';
        html += v
          ? `<td><span class="badge badge-blue">${escHtml(v)}</span></td>`
          : `<td style="opacity:.3">—</td>`;
      } else {
        const v = String(entry[col] ?? '');
        html += v ? `<td>${escHtml(v)}</td>` : `<td style="opacity:.3">—</td>`;
      }
    });
    html += '</tr>';
  });

  if (entries.length > PREVIEW_MAX) {
    html += `<tr><td colspan="${PREVIEW_COLS.length}" class="preview-more">… und ${entries.length - PREVIEW_MAX} weitere Einträge</td></tr>`;
  }

  html += '</tbody>';

  document.getElementById('previewTable').innerHTML = html;
  document.getElementById('rowCount').textContent =
    `${entries.length} Eintrag${entries.length !== 1 ? 'e' : ''}`;
  document.getElementById('previewCard').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
}


/* ================================================================
   VALIDATION
   ================================================================ */

/**
 * @param {{ type: 'err'|'warn', msg: string }[]} issues
 */
function renderValidation(issues) {
  const card = document.getElementById('validationCard');
  const list = document.getElementById('validationList');

  if (!issues.length) {
    card.classList.add('hidden');
    return;
  }

  list.innerHTML = issues.map(({ type, msg }) => `
    <div class="val-item ${type}">
      <span class="val-icon">${icon(type === 'err' ? 'x-circle' : 'alert-triangle', 13)}</span>
      <span>${escHtml(msg)}</span>
    </div>
  `).join('');

  card.classList.remove('hidden');
}


/* ================================================================
   CODE OUTPUT + SYNTAX HIGHLIGHTING
   ================================================================ */

/**
 * Render a JSON/JS string into #codeOutput with warm syntax highlighting.
 * @param {string} code
 */
function renderCode(code) {
  let html = escHtml(code);

  // JSON keys → blue
  html = html.replace(/(&quot;[^&]+&quot;)(\s*:)/g, '<span class="ck">$1</span>$2');
  // String values → green
  html = html.replace(/:(\s*)(&quot;[^&]*&quot;)/g, ':$1<span class="cv">$2</span>');
  // Boolean values
  html = html.replace(/:\s*(true|false)/g, (_, b) => `: <span class="cb">${b}</span>`);
  // null values
  html = html.replace(/:\s*(null)/g, ': <span class="cn">null</span>');
  // JS keywords
  html = html.replace(/^(const|export default)(\s+\w+\s*=\s*)?/m,
    (_, kw, rest) => `<span class="cm">${kw}</span>${rest || ''}`
  );

  document.getElementById('codeOutput').innerHTML = html;
}

/**
 * Show the output card.
 * @param {string} outputString
 */
function showOutput(outputString) {
  renderCode(outputString);
  document.getElementById('outputCard').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
}

/**
 * Reset all result cards to empty state.
 */
function resetOutput() {
  ['previewCard', 'outputCard', 'validationCard'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.getElementById('emptyState')?.classList.remove('hidden');
}


/* ================================================================
   COPY TO CLIPBOARD
   ================================================================ */

/**
 * @param {string} text
 * @param {HTMLElement} btn
 */
function copyToClipboard(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `${icon('check', 13)} Kopiert`;
    btn.classList.add('copied');
    showToast('JSON kopiert!');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('copied');
    }, 1800);
  }).catch(() => showToast('Kopieren fehlgeschlagen'));
}


/* ================================================================
   TOAST
   ================================================================ */

let _toastTimer = null;

/**
 * @param {string} msg
 */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}


/* ================================================================
   GENERATE BUTTON STATE
   ================================================================ */

function setGenerateEnabled(enabled) {
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = !enabled;
}
