/**
 * taxonomy-panel.js
 * Verwaltungsoberfläche für die semantische Taxonomie:
 * Baum anzeigen, eigene Kategorien anlegen, umbenennen, löschen,
 * Teilbaum-Blockade umschalten, Standard wiederherstellen.
 *
 * Abhängigkeiten: taxonomy.js, utils.js (escHtml), icons.js, ui.js (showToast),
 *                 app.js (_getAllEntries, _refreshAfterEdit – zur Laufzeit)
 */

'use strict';

/** Vorschau der Kategorie-Vorschläge geöffnet? */
let _taxSeedOpen = false;

/** Vorschläge (Wort → Kategorie) für alle noch unkategorisierten Einträge. */
function _taxCurrentSuggestions() {
  if (typeof _getAllEntries !== 'function' || typeof taxSeedSuggestions !== 'function') return [];
  return taxSeedSuggestions(_getAllEntries());
}

/** HTML-Block „Vorschläge“ (leer, wenn es keine gibt). */
function _taxSeedHtml(suggestions) {
  if (!suggestions.length) return '';
  const head = `<div class="tax-seed">
      <strong>${suggestions.length}</strong> Vorschlag${suggestions.length !== 1 ? 'e' : ''} aus der Wortliste für unkategorisierte Einträge
      <button class="btn btn-ghost btn-xs" data-tax-action="seed-toggle">${_taxSeedOpen ? 'Vorschau schließen' : 'Vorschau'}</button>
    </div>`;
  if (!_taxSeedOpen) return head;
  const rows = suggestions.slice(0, 400).map((x) => {
    const extra = x.weitere.length ? ` <span class="tax-hint">+ ${x.weitere.map(id => escHtml(taxLabel(id))).join(', ')}</span>` : '';
    return `<label class="tax-seed-row">
        <input type="checkbox" class="seed-pick" data-wortart="${escHtml(x.wortart)}" data-key="${escHtml(x.key)}" checked>
        <span class="tax-seed-word">${escHtml(x.key)}</span>
        <span>→ ${escHtml(taxLabel(x.primaer))}${extra}</span>
      </label>`;
  }).join('');
  const more = suggestions.length > 400 ? `<div class="tax-hint">… ${suggestions.length - 400} weitere werden mit „Auswahl übernehmen“ nicht angezeigt und nicht übernommen.</div>` : '';
  return head + `<div class="tax-seed-list">${rows}${more}</div>
    <div class="tax-footer">
      <button class="btn btn-primary btn-xs" data-tax-action="seed-apply">Auswahl übernehmen</button>
      <button class="btn btn-ghost btn-xs" data-tax-action="seed-all">Alle</button>
      <button class="btn btn-ghost btn-xs" data-tax-action="seed-none">Keine</button>
    </div>
    <p class="tax-help">Es werden nur Einträge ohne Hauptkategorie ergänzt; vorhandene Zuordnungen bleiben unberührt.</p>`;
}

/** Anzahl Einträge je Hauptkategorie (nur direkte Zuordnung). */
function _taxCountByPrimary() {
  const counts = new Map();
  if (typeof _getAllEntries !== 'function') return counts;
  _getAllEntries().forEach(({ entry }) => {
    const id = entry.semantik && entry.semantik.primaer;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
}

function renderTaxonomyPanel() {
  const host = document.getElementById('taxonomyPanel');
  if (!host) return;

  const counts = _taxCountByPrimary();
  const entries = (typeof _getAllEntries === 'function') ? _getAllEntries() : [];
  const uncategorized = entries.filter(({ entry }) => !(entry.semantik && entry.semantik.primaer)).length;

  const rows = taxFlatten().map(({ node, depth }) => {
    const n = counts.get(node.id) || 0;
    return `
      <li class="tax-row" data-id="${escHtml(node.id)}" style="padding-left:${depth * 14}px">
        <span class="tax-name${node.eigen ? ' tax-own' : ''}">${escHtml(node.name)}</span>
        ${n ? `<span class="stat-pill stat-pill--active" title="Einträge mit dieser Hauptkategorie">${n}</span>` : ''}
        <span class="tax-actions">
          <label class="tax-flag" title="Teilbaum blockieren: alle Einträge unterhalb dieser Kategorie gelten als gleichartig">
            <input type="checkbox" data-tax-action="flag" ${node.blockiereTeilbaum ? 'checked' : ''}> Teilbaum
          </label>
          <button class="btn btn-ghost btn-xs" data-tax-action="add" title="Unterkategorie anlegen">+</button>
          <button class="btn btn-ghost btn-xs" data-tax-action="rename" title="Umbenennen">${icon('edit-2', 11)}</button>
          <button class="btn btn-ghost btn-xs" data-tax-action="remove" title="Löschen">${icon('trash-2', 11)}</button>
        </span>
      </li>`;
  }).join('');

  const open = host.querySelector('details')?.open ? ' open' : '';
  host.innerHTML = `
    <details class="card tax-card"${open}>
      <summary class="section-label" style="cursor:pointer">Semantische Kategorien
        ${entries.length ? `<span class="tax-hint">(${uncategorized} von ${entries.length} Einträgen ohne Hauptkategorie)</span>` : ''}
      </summary>
      <p class="tax-help">
        Gleiche Hauptkategorie = semantisch redundant (z. B. <em>Rubin</em> + <em>Smaragd</em>); der Namensgenerator
        kombiniert sie nicht. Einträge ohne Kategorie blockieren nie.
      </p>
      ${_taxSeedHtml(_taxCurrentSuggestions())}
      <ul class="tax-list">${rows}</ul>
      <div class="tax-footer">
        <button class="btn btn-ghost btn-xs" data-tax-action="add-root">+ Oberkategorie</button>
        <button class="btn btn-ghost btn-xs" data-tax-action="reset">Standard wiederherstellen</button>
      </div>
    </details>`;
}

function _taxPromptName(title, initial) {
  const v = window.prompt(title, initial || '');
  return v === null ? null : v.trim();
}

function _taxHandleClick(e) {
  const el = e.target.closest('[data-tax-action]');
  if (!el) return;
  const action = el.dataset.taxAction;
  const id = el.closest('.tax-row')?.dataset.id;

  if (action === 'seed-toggle') { _taxSeedOpen = !_taxSeedOpen; renderTaxonomyPanel(); return; }
  if (action === 'seed-all' || action === 'seed-none') {
    document.querySelectorAll('#taxonomyPanel .seed-pick').forEach(cb => { cb.checked = action === 'seed-all'; });
    return;
  }
  if (action === 'seed-apply') { _taxApplySeedSelection(); return; }

  try {
    switch (action) {
      case 'flag':
        taxSetBlockSubtree(id, el.checked);
        return;
      case 'add-root': {
        const name = _taxPromptName('Name der neuen Oberkategorie:');
        if (name) taxAddNode(null, name);
        return;
      }
      case 'add': {
        const name = _taxPromptName(`Neue Unterkategorie unter „${taxGetNodes().get(id).name}“:`);
        if (name) taxAddNode(id, name);
        return;
      }
      case 'rename': {
        const name = _taxPromptName('Neuer Name:', taxGetNodes().get(id).name);
        if (name) taxRenameNode(id, name);
        return;
      }
      case 'remove': {
        const node = taxGetNodes().get(id);
        const parent = node.parent;
        const doomed = new Set([id, ...taxFlatten().filter(x => taxPath(x.node.id).includes(id)).map(x => x.node.id)]);
        const affected = (typeof _getAllEntries === 'function' ? _getAllEntries() : [])
          .filter(({ entry }) => entry.semantik && (doomed.has(entry.semantik.primaer) ||
            (entry.semantik.weitere || []).some(w => doomed.has(w)))).length;
        const target = parent ? `„${taxGetNodes().get(parent).name}“` : null;
        const msg = `„${node.name}“${doomed.size > 1 ? ` samt ${doomed.size - 1} Unterkategorie(n)` : ''} löschen?` +
          (affected ? `\n\n${affected} Eintrag/Einträge betroffen: ` +
            (target ? `die Hauptkategorie wechselt zu ${target}.` : 'sie verlieren die Hauptkategorie.') : '');
        if (window.confirm(msg)) taxRemoveNode(id, parent);
        return;
      }
      case 'reset':
        if (window.confirm('Standard-Taxonomie wiederherstellen? Eigene Kategorien und Umbenennungen gehen verloren; Zuordnungen auf entfernte Kategorien werden aufgehoben.')) {
          const before = new Set(taxGetNodes().keys());
          taxReset();
          const after = taxGetNodes();
          const gone = [...before].filter(k => !after.has(k));
          if (gone.length && typeof _getAllEntries === 'function') {
            taxRepairEntries(_getAllEntries().map(x => x.entry), gone, null);
          }
          if (typeof _refreshAfterEdit === 'function') _refreshAfterEdit();
        }
        return;
    }
  } catch (err) {
    showToast(err.message);
  }
}

/** Übernimmt die angehakten Vorschläge (nur Einträge ohne Hauptkategorie). */
function _taxApplySeedSelection() {
  const picked = new Set(Array.from(document.querySelectorAll('#taxonomyPanel .seed-pick:checked'))
    .map(cb => cb.dataset.wortart + '\u0000' + cb.dataset.key));
  if (!picked.size) { showToast('Keine Vorschläge ausgewählt'); return; }

  const all = _getAllEntries();
  const byId = new Map(all.map(x => [x.entry.wortart + '\u0000' + x.key, x]));
  let n = 0;
  _taxCurrentSuggestions().forEach((sug) => {
    const id = sug.wortart + '\u0000' + sug.key;
    if (!picked.has(id)) return;
    const hit = byId.get(id);
    const panel = _panels.get(sug.wortart);
    if (hit && panel && panel.updateEntry(sug.key, taxSeedApply(hit.entry, sug))) n++;
  });
  _taxSeedOpen = false;
  showToast(`${n} Eintrag${n !== 1 ? 'e' : ''} kategorisiert`);
  _refreshAfterEdit();
}

function initTaxonomyPanel() {
  const host = document.getElementById('taxonomyPanel');
  if (!host) return;
  host.addEventListener('click', _taxHandleClick);
  host.addEventListener('change', (e) => {
    if (e.target.matches('[data-tax-action="flag"]')) _taxHandleClick(e);
  });
  taxOnChange((evt) => {
    if (evt.type === 'remove' && typeof _getAllEntries === 'function') {
      taxRepairEntries(_getAllEntries().map(x => x.entry), evt.removed, evt.replacement);
    }
    renderTaxonomyPanel();
    // Vorschau nachziehen (Namen/Zuordnungen können sich geändert haben)
    if (typeof _refreshAfterEdit === 'function' &&
        !document.getElementById('previewCard')?.classList.contains('hidden')) {
      _refreshAfterEdit();
    }
  });
  renderTaxonomyPanel();
}
