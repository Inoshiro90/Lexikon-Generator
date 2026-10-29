/**
 * lexikon-loader.js
 * „Lexikon laden“: liest eine komplette Lexikon-JSON (Ausgabe dieses Tools,
 * gruppiert nach Wortart, optional mit eingebetteter _taxonomie) und verteilt
 * die Einträge auf die Wortart-Panels. Ersetzt den aktuellen Inhalt.
 *
 * Abhängigkeiten: text-formats.js (parseJSONFormat), taxonomy.js, import-panel.js,
 *                 app.js (_panels, _refreshAfterEdit, setGenerateEnabled – zur Laufzeit)
 */

'use strict';

/** true, solange das Gesamtlexikon geladen wird (unterdrückt Einzel-Toasts). */
let LEXIKON_BULK_LOADING = false;

/**
 * @param {string} text  JSON-Text
 * @returns {{ total:number, perWortart:Object<string,number>, warnings:string[] }}
 */
function loadLexikonText(text) {
  taxResetImportWarnings();
  const rows = parseJSONFormat(text);          // übernimmt auch eine eingebettete _taxonomie

  const byWortart = new Map();
  const unknown = [];
  rows.forEach((row) => {
    const w = row.wortart ? String(row.wortart).trim() : '';
    if (_panels.has(w)) {
      if (!byWortart.has(w)) byWortart.set(w, []);
      byWortart.get(w).push(row);
    } else {
      unknown.push(row.key || '(ohne Schlüssel)');
    }
  });
  if (unknown.length) {
    taxWarn(`${unknown.length} Eintrag/Einträge mit unbekannter oder fehlender Wortart übersprungen: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? ' …' : ''}`);
  }

  const perWortart = {};
  LEXIKON_BULK_LOADING = true;
  try {
    _panels.forEach((panel, key) => {
      panel.clear();
      const list = byWortart.get(key) || [];
      perWortart[key] = list.length ? panel.importRows(list, 'json', true) : 0;
    });
  } finally {
    LEXIKON_BULK_LOADING = false;
  }

  const total = Object.values(perWortart).reduce((a, b) => a + b, 0);
  setGenerateEnabled(total > 0);
  if (total > 0) _refreshAfterEdit();
  if (typeof renderTaxonomyPanel === 'function') renderTaxonomyPanel();
  return { total, perWortart, warnings: [...TAX_IMPORT_WARNINGS] };
}

function initLexikonLoader() {
  const host = document.getElementById('lexikonLoader');
  if (!host) return;

  host.innerHTML = `
    <details class="acc">
      <summary class="acc-summary">
        <span class="acc-icon" aria-hidden="true">${icon('file-braces', 15)}</span>
        <span class="acc-heading"><span class="acc-title">Lexikon laden (JSON)</span></span>
        <span class="acc-chevron" aria-hidden="true">${icon('chevron-down', 14)}</span>
      </summary>
      <div class="acc-body">
      <p class="help-text">Lädt ein komplettes, mit diesem Tool erzeugtes Lexikon samt Kategorien. Der aktuelle Inhalt aller Wortart-Panels wird ersetzt.</p>
      <label class="field-label" for="lexikonLoadText">Lexikon-JSON</label>
      <textarea class="form-textarea" id="lexikonLoadText" rows="3" placeholder="JSON hier einfügen …" spellcheck="false"></textarea>
      <div class="tax-footer">
        <button type="button" class="btn btn-ghost btn-sm" id="lexikonLoadTextBtn">Aus Text laden</button>
        <button type="button" class="btn btn-ghost btn-sm" id="lexikonLoadFileBtn">Datei wählen …</button>
        <input type="file" id="lexikonLoadFile" accept=".json,.txt" hidden>
      </div>
      <div id="lexikonLoadStatus" class="import-status hidden" role="status"></div>
      </div>
    </details>`;

  const status = host.querySelector('#lexikonLoadStatus');
  const show = (type, html) => { status.className = `import-status ${type}`; status.innerHTML = html; };

  const run = (text) => {
    try {
      const res = loadLexikonText(text);
      if (!res.total) { show('warn', `${icon('alert-triangle', 12)} Keine Einträge gefunden.` + _loaderWarnings(res.warnings)); return; }
      const parts = Object.entries(res.perWortart).filter(([, n]) => n).map(([k, n]) => `${n} ${escHtml(k)}`).join(', ');
      show('success', `${icon('check', 12)} <strong>${res.total}</strong> Einträge geladen (${parts})` + _loaderWarnings(res.warnings));
      showToast(`${res.total} Einträge geladen`);
    } catch (err) {
      show('error', `${icon('x-circle', 12)} ${escHtml(err.message)}`);
    }
  };

  host.querySelector('#lexikonLoadTextBtn').addEventListener('click', () => {
    const t = host.querySelector('#lexikonLoadText').value;
    if (!t.trim()) { show('warn', `${icon('alert-triangle', 12)} Eingabe ist leer.`); return; }
    run(t);
  });
  const fileInput = host.querySelector('#lexikonLoadFile');
  host.querySelector('#lexikonLoadFileBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => run(String(e.target.result));
    reader.onerror = () => show('error', `${icon('x-circle', 12)} Datei nicht lesbar.`);
    reader.readAsText(f, 'utf-8');
  });
}

function _loaderWarnings(list) {
  if (!list.length) return '';
  return list.slice(0, 20).map(m => `<div class="val-item warn">${icon('alert-triangle', 11)} ${escHtml(m)}</div>`).join('') +
    (list.length > 20 ? `<div class="val-item warn">… und ${list.length - 20} weitere Hinweise</div>` : '');
}
