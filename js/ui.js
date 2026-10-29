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
/* ── Spalten-Bausteine ───────────────────────────────────────
 * Alle Setter legen fehlende verschachtelte Objekte (formen/position/fuge) selbst an
 * (entryEnsure aus entry-edit.js), damit das Bearbeiten nie an `undefined` scheitert.
 * `value(k,e)` = Eingabewert (für „geändert?“), `get` = Anzeigewert, `required` = Pflichtfeld.
 */

const _colWord = (label) => ({ key: 'wort', label, get: (k, e) => k, editable: false });

const _colStamm = () => ({
  key: 'stamm', label: 'Stamm', required: true,
  get: (k, e) => e.stamm || '',
  set: (e, v) => {
    const old = e.stamm;
    e.stamm = v;
    // Verben spiegeln den Stamm zusätzlich in formen.stamm – synchron halten
    if (e.formen && typeof e.formen === 'object' && e.formen.stamm !== undefined && e.formen.stamm === old) e.formen.stamm = v;
  },
});

const _colForm = (key, label, required) => ({
  key, label, required: !!required,
  get: (k, e) => (e.formen && e.formen[key]) || '',
  set: (e, v) => { entryEnsure(e, 'formen')[key] = v; },
});

const _colPos = (side, label) => ({
  key: side, label, type: 'bool',
  get: (k, e) => e.position ? e.position[side] : undefined,
  value: (k, e) => String(!!(e.position && e.position[side])),
  set: (e, v) => { entryEnsure(e, 'position')[side] = (v === 'true'); },
});

const _colFuge = (side, label) => ({
  key: 'fuge_' + side, label, hint: 'Komma-getrennt; ∅ = keine Fuge, „∅,s“ = keine oder s',
  get: (k, e) => fugeToText(e.fuge ? e.fuge['als_' + side] : null),
  set: (e, v) => { entryEnsure(e, 'fuge')['als_' + side] = fugeFromText(v, !!(e.position && e.position[side])); },
});

const _colGenus = () => ({
  key: 'genus', label: 'Genus', type: 'select', options: ['', ...ENTRY_VALID_GENUS],
  get: (k, e) => e.genus || '',
  set: (e, v) => { if (v) e.genus = v; else delete e.genus; },
});

const _colsPosFuge = () => [
  _colPos('erst', 'Erst'), _colPos('zweit', 'Zweit'),
  _colFuge('erst', 'Fuge (Erst)'), _colFuge('zweit', 'Fuge (Zweit)'),
];

/**
 * Spaltenkonfiguration je Wortart.
 * get(key, entry) → Anzeigewert · set(entry, val) → Wert zurückschreiben
 * type: 'bool' | 'select' → <select>, sonst <input>; 'katlevel' | 'katmulti' → Kategorie (siehe unten)
 * editable:false → nicht bearbeitbar (Schlüssel/Wort)
 */
const WORTART_PREVIEW_COLS = {
  Nomen: [
    _colWord('Wort'), _colGenus(), _colStamm(),
    _colForm('nom_sg', 'Singular', true), _colForm('gen_sg', 'Genitiv', true), _colForm('plural', 'Plural', true),
    ..._colsPosFuge(),
  ],
  Verb: [
    _colWord('Infinitiv'), _colStamm(), _colForm('infinitiv', 'Form', true), ..._colsPosFuge(),
  ],
  Adjektiv: [
    _colWord('Wort'), _colStamm(), _colForm('positiv', 'Positiv', true),
    _colForm('komparativ', 'Komparativ'), _colForm('superlativ', 'Superlativ'), ..._colsPosFuge(),
  ],
  Präposition: [ _colWord('Wort'), _colStamm(), _colForm('grundform', 'Grundform', true), ..._colsPosFuge() ],
  Adverb:      [ _colWord('Wort'), _colStamm(), _colForm('grundform', 'Grundform', true), ..._colsPosFuge() ],
  Partikel:    [ _colWord('Wort'), _colStamm(), _colForm('grundform', 'Grundform', true), ..._colsPosFuge() ],
};

/* ── Semantische Kategorie ────────────────────────────────────
 * Kategorie_1 … Kategorie_5 sind EINE Darstellung des Pfads der Hauptkategorie
 * (entry.semantik.primaer), keine fünf unabhängigen Zuordnungen.
 * „Weitere Kategorien“ (entry.semantik.weitere) bleiben eine eigene Mehrfachauswahl.
 */

/** Rückwärtskompatibler Name; die Logik liegt in entry-edit.js. */
function _applySemantik(entry, primaer, weitere) { entrySetSemantik(entry, primaer, weitere); }

const _primaerOf = (e) => (e && e.semantik && e.semantik.primaer) || '';

Object.keys(WORTART_PREVIEW_COLS).forEach(w => {
  for (let level = 1; level <= TAX_MAX_DEPTH; level++) {
    WORTART_PREVIEW_COLS[w].push({
      key: 'kat' + level, label: 'Kategorie_' + level, level, type: 'katlevel',
      hint: `Ebene ${level} des Kategoriepfads`,
      get: (k, e) => { const c = taxPathColumns(_primaerOf(e)).levels[level - 1]; return c ? c.name : ''; },
    });
  }
  WORTART_PREVIEW_COLS[w].push({
    key: 'weitere', label: 'Weitere Kategorien', type: 'katmulti',
    hint: 'Zusätzliche Zuordnungen (blockieren keine Komposita)',
    get: (k, e) => ((e.semantik && e.semantik.weitere) || []).map(id => taxLabel(id)).join('; '),
    value: (k, e) => (e.semantik && e.semantik.weitere) || [],
    set: (e, v) => { entrySetSemantik(e, undefined, Array.isArray(v) ? v : []); },
  });
});

/** <option>-Liste der Taxonomie (eingerückt). selected: Set von ids. */
function _katOptionsHtml(selected, withEmpty) {
  const sel = selected || new Set();
  let html = withEmpty ? `<option value="" ${sel.size === 0 ? 'selected' : ''}>— keine —</option>` : '';
  taxFlatten().forEach(({ node, depth }) => {
    html += `<option value="${escHtml(node.id)}" ${sel.has(node.id) ? 'selected' : ''}>` +
      `${'\u00A0\u00A0'.repeat(depth)}${escHtml(node.name)}</option>`;
  });
  // Unbekannte (gelöschte) ids sichtbar halten, damit sie beim Speichern nicht still verloren gehen
  sel.forEach(id => {
    if (id && !taxIsKnown(id)) html += `<option value="${escHtml(id)}" selected>⚠ ${escHtml(id)} (unbekannt)</option>`;
  });
  return html;
}

/** <select> für eine Ebene (1–5) bei gegebener Auswahl; leer, wenn die Ebene darüber nichts gewählt hat. */
function _katLevelSelectHtml(level, selection) {
  const options = taxColumnOptions(level, selection);
  const current = selection[level - 1] || '';
  // gesperrt, solange die Ebene darüber leer ist oder die gewählte Kategorie keine Unterkategorien hat
  const disabled = level > 1 && (!selection[level - 2] || options.length === 0);
  const opts = `<option value="">—</option>` + options.map(n =>
    `<option value="${escHtml(n.id)}" ${n.id === current ? 'selected' : ''}>${escHtml(n.name)}</option>`).join('');
  return `<select class="cell-select kat-level" data-field-input="kat${level}" data-kat-level="${level}" ` +
    `aria-label="Kategorie_${level} (Ebene ${level})" ${disabled ? 'disabled' : ''}>${opts}</select>`;
}

/** Schlüssel für den Lookup: Wortart + Wort (gleiche Wörter in mehreren Wortarten kollidieren nicht). */
function _previewMapKey(wortart, key) { return `${wortart}\u0000${key}`; }

/** Laufzeit-Lookup: wortart+key → { wortart, entry } für Edit-Callbacks // hinzugefügt */
let _previewEntryMap = new Map();

/** Callbacks für Löschen und Aktualisieren — gesetzt via initPreviewCallbacks // hinzugefügt */
let _previewCallbacks = { onDelete: null, onUpdate: null, onBulkUpdate: null };

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
  const pc = taxPathColumns(_primaerOf(entry));
  const label = escHtml(key);
  let cells = '<td class="col-sel" data-field="sel"><label class="check-target"><input type="checkbox" class="row-sel" ' +
    `aria-label="Zeile „${label}“ auswählen"></label></td>`;
  cols.forEach(col => {
    const val = col.get(key, entry);
    if (col.type === 'bool') {
      cells += `<td data-field="${col.key}" class="preview-bool">` +
        (val ? `<span class="bool-true" role="img" aria-label="ja">${icon('check', 11)}</span>`
             : `<span class="bool-false" role="img" aria-label="nein">—</span>`) +
        '</td>';
    } else if (col.type === 'katlevel') {
      // Ebene des Kategoriepfads; unbekannte ids und zu tiefe Pfade sichtbar markieren
      let inner = val ? escHtml(String(val)) : '<span class="cell-empty" role="img" aria-label="leer">—</span>';
      if (col.level === 1 && pc.unknown) {
        inner = `<span class="kat-warn" title="Unbekannte Kategorie-ID – bleibt unverändert, solange sie nicht neu gewählt wird">⚠ ${escHtml(_primaerOf(entry))}</span>`;
      }
      if (col.level === TAX_MAX_DEPTH && pc.deep) {
        inner += ` <span class="kat-warn" title="Pfad ist tiefer als ${TAX_MAX_DEPTH} Ebenen: ${escHtml(taxLabel(_primaerOf(entry)))}">…</span>`;
      }
      cells += `<td data-field="${col.key}" class="kat-cell">${inner}</td>`;
    } else {
      cells += `<td data-field="${col.key}"${col.key === 'wort' ? ' class="col-wort"' : ''}>${val ? escHtml(String(val)) : '<span class="cell-empty" role="img" aria-label="leer">—</span>'}</td>`;
    }
  });

  cells += `<td class="col-actions" data-field="actions"><div class="row-actions">
    <button type="button" class="btn btn-icon" data-action="edit"
            title="Eintrag „${label}“ bearbeiten" aria-label="Eintrag „${label}“ bearbeiten">${icon('edit-2', 14)}</button>
    <button type="button" class="btn btn-icon btn-danger-quiet" data-action="delete"
            title="Eintrag „${label}“ löschen" aria-label="Eintrag „${label}“ löschen">${icon('trash-2', 14)}</button>
  </div></td>`;

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
    '<th scope="col" class="col-sel"><label class="check-target"><input type="checkbox" class="sel-all" title="Alle auswählen" aria-label="Alle Zeilen dieser Wortart auswählen"></label></th>' +
    cols.map(c => `<th scope="col"${c.key === 'wort' ? ' class="col-wort"' : ''}${c.hint ? ` title="${escHtml(c.hint)}"` : ''}>${escHtml(c.label)}</th>`).join('') +
    '<th scope="col" class="col-actions-head">Aktionen</th>' +
    '</tr></thead>';

  const tbody = '<tbody>' +
    entries.map(({ key, entry }) => _renderViewRow(wortart, key, entry, cols)).join('') +
    '</tbody>';

  return `
    <div class="wortart-section" data-section="${escHtml(wortart)}">
      <div class="wortart-section-header">
        <span class="wortart-section-label">${escHtml(wortart)}</span>
        <span class="stat-pill stat-pill--active">${entries.length}</span>
        <div class="bulk-bar">
          <select class="form-select bulk-kat" aria-label="Kategorie für Auswahl">
            <option value="" selected disabled>Kategorie für Auswahl…</option>
            <option value="__clear__">— Kategorie entfernen —</option>
            ${_katOptionsHtml(new Set(), false)}
          </select>
          <button type="button" class="btn btn-ghost btn-sm" data-action="bulk-assign"
                  title="Hauptkategorie für alle angehakten Zeilen setzen">Zuweisen</button>
        </div>
      </div>
      <div class="preview-wrap" tabindex="0" role="region" aria-label="Tabelle ${escHtml(wortart)} (horizontal scrollbar)">
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
/**
 * Die Vorschau wird nach jeder Änderung komplett neu gerendert. Lag der Tastaturfokus in der Vorschau
 * (z. B. auf „Speichern“ oder „Zuweisen“), wird er danach sinnvoll wiederhergestellt – sonst landet er auf <body>.
 */
function _previewFocusSnapshot() {
  const body = document.getElementById('previewBody');
  const el = document.activeElement;
  if (!body || !el || !body.contains(el)) return null;
  const section = el.closest('.wortart-section');
  const snap = { section: section ? section.dataset.section : null };
  if (el.matches('.bulk-kat')) return { ...snap, kind: 'bulk-select' };
  if (el.matches('[data-action="bulk-assign"]')) return { ...snap, kind: 'bulk-button' };
  if (el.matches('.sel-all')) return { ...snap, kind: 'sel-all' };
  const tr = el.closest('tr[data-key]');
  if (!tr || !section) return null;
  const rows = Array.from(section.querySelectorAll('tbody tr[data-key]'));
  return { ...snap, kind: 'row', wortart: tr.dataset.wortart, key: tr.dataset.key, index: rows.indexOf(tr), rowSel: el.matches('.row-sel') };
}

function _previewRestoreFocus(snap) {
  const body = document.getElementById('previewBody');
  if (!snap || !body) return;
  const sec = Array.from(body.querySelectorAll('.wortart-section')).find(x => x.dataset.section === snap.section);
  let target = null;
  if (sec && snap.kind === 'bulk-select') target = sec.querySelector('.bulk-kat');
  else if (sec && snap.kind === 'bulk-button') target = sec.querySelector('[data-action="bulk-assign"]');
  else if (sec && snap.kind === 'sel-all') target = sec.querySelector('.sel-all');
  else if (sec && snap.kind === 'row') {
    const rows = Array.from(sec.querySelectorAll('tbody tr[data-key]'));
    const same = rows.find(r => r.dataset.key === snap.key && r.dataset.wortart === snap.wortart);
    // Zeile noch da → deren Bearbeiten-Schaltfläche (bzw. Checkbox); gelöscht → Nachbarzeile an gleicher Position
    const row = same || rows[Math.min(snap.index, rows.length - 1)];
    if (row) target = (same && snap.rowSel) ? row.querySelector('.row-sel') : row.querySelector('[data-action="edit"]');
  }
  if (!target) target = document.getElementById('generateBtn');
  if (target && !target.disabled) target.focus();
}

function renderPreviewGrouped(allEntries) {
  const focusSnap = _previewFocusSnapshot();
  // Horizontale Scrollposition je Wortart merken (Tabellen sind breit)
  const scrolls = {};
  document.querySelectorAll('#previewBody .wortart-section').forEach(sec => {
    const wrap = sec.querySelector('.preview-wrap');
    if (wrap) scrolls[sec.dataset.section] = wrap.scrollLeft;
  });

  // Lookup-Map aktualisieren
  _previewEntryMap.clear();
  allEntries.forEach(({ key, entry }) => {
    _previewEntryMap.set(_previewMapKey(entry.wortart, key), { wortart: entry.wortart, entry });
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
  document.querySelectorAll('#previewBody .wortart-section').forEach(sec => {
    const wrap = sec.querySelector('.preview-wrap');
    if (wrap && scrolls[sec.dataset.section]) wrap.scrollLeft = scrolls[sec.dataset.section];
  });

  document.getElementById('rowCount').textContent =
    `${allEntries.length} Eintrag${allEntries.length !== 1 ? 'e' : ''}`;

  document.getElementById('previewCard').classList.remove('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  _previewRestoreFocus(focusSnap);
}

/**
 * Event-Delegation-Handler für alle Aktionen in der Vorschau.
 * // hinzugefügt
 */
/** Läuft gerade eine Zeilenbearbeitung? (liefert die Zeile oder null) */
function _editingRow() { return document.querySelector('#previewBody tr.row-editing'); }

/** Verhindert, dass ein Neu-Rendern ungespeicherte Eingaben einer anderen Zeile verwirft. */
function _blockedByEditing(row) {
  const editing = _editingRow();
  if (!editing || editing === row) return false;
  showToast('Bitte zuerst die laufende Bearbeitung speichern oder abbrechen');
  editing.querySelector('[data-action="save"]')?.focus();
  return true;
}

function _handlePreviewAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  // Sammelzuweisung: Hauptkategorie für alle angehakten Zeilen einer Sektion
  if (btn.dataset.action === 'bulk-assign') {
    if (_editingRow()) { _blockedByEditing(null); return; }
    _bulkAssign(btn);
    return;
  }

  const row = btn.closest('tr[data-key]');
  if (!row) return;

  const entryKey = row.dataset.key;
  const wortart  = row.dataset.wortart;
  const info     = _previewEntryMap.get(_previewMapKey(wortart, entryKey));
  if (!info) return;

  switch (btn.dataset.action) {
    case 'delete':
      if (_blockedByEditing(row)) break;
      if (_previewCallbacks.onDelete) _previewCallbacks.onDelete(wortart, entryKey);
      break;
    case 'edit':
      if (_blockedByEditing(row)) break;
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
 * Setzt die Hauptkategorie für alle angehakten Zeilen der Sektion.
 * Bestehende weitere Kategorien bleiben erhalten.
 */
function _bulkAssign(btn) {
  const section = btn.closest('.wortart-section');
  if (!section) return;
  const wortart = section.dataset.section;
  const select  = section.querySelector('.bulk-kat');
  const value   = select ? select.value : '';
  if (!value) { showToast('Bitte zuerst eine Kategorie wählen'); return; }

  const rows = Array.from(section.querySelectorAll('tbody tr[data-key]'))
    .filter(r => r.querySelector('.row-sel')?.checked);
  if (!rows.length) { showToast('Keine Zeilen ausgewählt'); return; }

  const updates = [];
  rows.forEach(r => {
    const info = _previewEntryMap.get(_previewMapKey(wortart, r.dataset.key));
    if (!info) return;
    const updated = JSON.parse(JSON.stringify(info.entry));
    _applySemantik(updated, value === '__clear__' ? null : value, undefined);
    updates.push({ key: r.dataset.key, entry: updated });
  });
  if (_previewCallbacks.onBulkUpdate) _previewCallbacks.onBulkUpdate(wortart, updates);
}

/**
 * Schaltet eine Zeile in den Edit-Modus: jede editierbare Zelle bekommt ein Eingabeelement.
 * Kategorie_1–5 werden als abhängige Dropdowns gezeigt; ohne Änderung bleibt die Kategorie
 * (auch unbekannte oder zu tiefe) beim Speichern unangetastet.
 */
function _enterEditMode(row, wortart, entryKey, entry) {
  const cols = WORTART_PREVIEW_COLS[wortart] || [];
  const pc = taxPathColumns(_primaerOf(entry));
  const selection = pc.levels.map(l => (l ? l.id : ''));
  row.dataset.katDirty = '0';

  cols.forEach(col => {
    if (col.editable === false) return;
    const cell = row.querySelector(`[data-field="${col.key}"]`);
    if (!cell) return;
    const val = col.get(entryKey, entry);
    const label = `${col.label} von ${escHtml(entryKey)}`;
    if (col.type === 'bool') {
      const on = String(!!val) === 'true';
      cell.innerHTML =
        `<select class="cell-select" data-field-input="${col.key}" aria-label="${label}">
          <option value="true"  ${on ? 'selected' : ''}>✓ ja</option>
          <option value="false" ${!on ? 'selected' : ''}>— nein</option>
        </select>`;
    } else if (col.type === 'select') {
      cell.innerHTML =
        `<select class="cell-select" data-field-input="${col.key}" aria-label="${label}">` +
        col.options.map(o => `<option value="${escHtml(o)}" ${o === String(val || '') ? 'selected' : ''}>${o ? escHtml(o) : '—'}</option>`).join('') +
        '</select>';
    } else if (col.type === 'katlevel') {
      let warn = '';
      if (col.level === 1 && pc.unknown) {
        warn = `<span class="kat-warn" title="Unbekannte Kategorie „${escHtml(_primaerOf(entry))}“ – bleibt erhalten, bis eine Kategorie gewählt wird">⚠</span> `;
      }
      if (col.level === TAX_MAX_DEPTH && pc.deep) {
        warn = `<span class="kat-warn" title="Pfad tiefer als ${TAX_MAX_DEPTH} Ebenen: ${escHtml(taxLabel(_primaerOf(entry)))} – bleibt erhalten, bis eine Kategorie gewählt wird">…</span> `;
      }
      cell.innerHTML = warn + _katLevelSelectHtml(col.level, selection);
    } else if (col.type === 'katmulti') {
      cell.innerHTML =
        `<select class="cell-select" multiple size="4" data-field-input="${col.key}" aria-label="${label}">` +
        `${_katOptionsHtml(new Set(col.value(entryKey, entry)), false)}</select>`;
    } else {
      cell.innerHTML =
        `<input class="cell-input" data-field-input="${col.key}" aria-label="${label}"
                ${col.required ? 'required' : ''} value="${escHtml(String(val ?? ''))}" />`;
    }
  });

  // Aktionen-Spalte umschalten
  const actionCell = row.querySelector('[data-field="actions"]');
  if (actionCell) {
    actionCell.innerHTML =
      `<div class="row-actions"><button type="button" class="btn btn-icon btn-primary" data-action="save"
               title="Änderungen speichern (Enter)" aria-label="Änderungen an „${escHtml(entryKey)}“ speichern">${icon('check', 14)}</button>
       <button type="button" class="btn btn-icon btn-secondary" data-action="cancel"
               title="Abbrechen (Esc)" aria-label="Bearbeitung von „${escHtml(entryKey)}“ abbrechen">${icon('x', 14)}</button></div>`;
  }

  row.classList.add('row-editing');
  row.querySelector('.cell-input, .cell-select')?.focus();
}

/** Markiert fehlerhafte Felder (aria-invalid) und nennt die Fehler. */
function _showEditErrors(row, errors) {
  row.querySelectorAll('[aria-invalid]').forEach(el => { el.removeAttribute('aria-invalid'); el.classList.remove('cell-invalid'); });
  let firstInvalid = null;
  errors.forEach(({ field, msg }) => {
    const el = row.querySelector(`[data-field-input="${field}"]`) ||
      (field === 'kategorie' ? row.querySelector('[data-kat-level]') : null);
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      el.classList.add('cell-invalid');
      el.title = msg;
      if (!firstInvalid) firstInvalid = el;
    }
  });
  showToast('Nicht gespeichert: ' + Array.from(new Set(errors.map(e => e.msg))).slice(0, 3).join(' · '));
  firstInvalid?.focus();
}

/**
 * Liest die Eingaben aus, validiert und schreibt über onUpdate in den Panelzustand.
 * Es wird mit einem Deep-Clone gearbeitet (siehe entryApplyEdits); ohne Änderung passiert nichts.
 */
function _commitEdit(row, wortart, entryKey, originalEntry) {
  const cols = WORTART_PREVIEW_COLS[wortart] || [];
  const values = {};
  cols.forEach(col => {
    if (!col.set || col.type === 'katlevel') return;
    const input = row.querySelector(`[data-field-input="${col.key}"]`);
    if (!input) return;
    values[col.key] = col.type === 'katmulti'
      ? Array.from(input.selectedOptions).map(o => o.value)
      : (col.type === 'bool' || col.type === 'select' ? input.value : String(input.value).trim());
  });

  // Kategorie nur anfassen, wenn der Nutzer eine Ebene geändert hat
  const kategorieAuswahl = row.dataset.katDirty === '1'
    ? Array.from(row.querySelectorAll('[data-kat-level]')).map(sel => sel.value)
    : null;

  const res = entryApplyEdits(originalEntry, cols, values, { key: entryKey, kategorieAuswahl });
  if (res.errors.length) { _showEditErrors(row, res.errors); return; }
  if (!res.changed) {
    _cancelEdit(row, wortart, entryKey, originalEntry);
    showToast('Keine Änderungen');
    return;
  }
  if (_previewCallbacks.onUpdate) _previewCallbacks.onUpdate(wortart, entryKey, res.entry);
}

/** Edit abbrechen: Zeile unverändert zurück in den View-Modus rendern. */
function _cancelEdit(row, wortart, entryKey, entry) {
  const cols    = WORTART_PREVIEW_COLS[wortart] || [];
  const newRow  = document.createElement('tbody');
  newRow.innerHTML = _renderViewRow(wortart, entryKey, entry, cols);
  const fresh = newRow.firstElementChild;
  row.replaceWith(fresh);
  fresh.querySelector('[data-action="edit"]')?.focus();
}

/** Abhängige Dropdowns: Änderung einer Ebene leert und befüllt die tieferen Ebenen neu. */
function _onKatLevelChange(select) {
  const row = select.closest('tr');
  if (!row) return;
  const level = Number(select.dataset.katLevel);
  const current = Array.from(row.querySelectorAll('[data-kat-level]')).map(s => s.value);
  const next = taxCascade(current, level, select.value);
  for (let l = level + 1; l <= TAX_MAX_DEPTH; l++) {
    const cell = row.querySelector(`[data-field="kat${l}"]`);
    if (cell) cell.innerHTML = _katLevelSelectHtml(l, next);
  }
  row.dataset.katDirty = '1';
  row.querySelectorAll('.kat-warn').forEach(el => el.remove());   // Warnhinweise gelten nur für den alten Pfad
}

/**
 * Initialisiert den Event-Listener auf #previewBody.
 * Muss nach DOMContentLoaded aufgerufen werden.
 * // hinzugefügt
 */
function initPreviewEvents() {
  const body = document.getElementById('previewBody');
  body?.addEventListener('click', _handlePreviewAction);
  body?.addEventListener('change', (e) => {
    if (e.target.classList.contains('sel-all')) {
      const section = e.target.closest('.wortart-section');
      section?.querySelectorAll('.row-sel').forEach(cb => { cb.checked = e.target.checked; });
    } else if (e.target.classList.contains('kat-level')) {
      _onKatLevelChange(e.target);
    }
  });
  // Tastatur: Enter speichert, Esc bricht ab (nur in Eingabefeldern einer Zeile im Edit-Modus)
  body?.addEventListener('keydown', (e) => {
    const row = e.target.closest && e.target.closest('tr.row-editing');
    if (!row) return;
    if (e.key === 'Escape') { e.preventDefault(); row.querySelector('[data-action="cancel"]')?.click(); }
    else if (e.key === 'Enter' && e.target.classList.contains('cell-input')) {
      e.preventDefault(); row.querySelector('[data-action="save"]')?.click();
    }
  });
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
  // längere Meldungen bleiben länger sichtbar (Lesezeit), mindestens 2,4 s
  _toastTimer = setTimeout(() => el.classList.remove('show'), Math.max(2400, String(msg).length * 70));
}


/* ================================================================
   GENERATE BUTTON STATE
   ================================================================ */

function setGenerateEnabled(enabled) {
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = !enabled;
}
