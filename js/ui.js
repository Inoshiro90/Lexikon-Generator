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
   PREVIEW TABLE
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
