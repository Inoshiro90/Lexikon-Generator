/**
 * taxonomy-panel.js
 * Verwaltungsoberfläche für die semantische Taxonomie:
 * Baum anzeigen, eigene Kategorien anlegen, umbenennen, löschen,
 * Teilbaum-Blockade umschalten, Standard wiederherstellen.
 *
 * Eingaben/Bestätigungen laufen über die anwendungseigenen Dialoge (dialog.js, appDialog) –
 * keine nativen window.prompt/confirm mehr.
 *
 * Abhängigkeiten: taxonomy.js, utils.js (escHtml), icons.js, dialog.js (appDialog), ui.js (showToast),
 *                 app.js (_getAllEntries, _refreshAfterEdit – zur Laufzeit)
 */

'use strict';

/** Vorschau der Kategorie-Vorschläge geöffnet? */
let _taxSeedOpen = false;

/**
 * Aufgeklappte Kategorien (nur Anzeigezustand, nicht Teil des Datenmodells). Bleibt über Neu-Rendern
 * erhalten; ids, die es nicht mehr gibt, werden beim Rendern verworfen. Standard: alles zugeklappt.
 */
const _taxOpenIds = new Set();

/** Vorschläge (Wort → Kategorie) für alle noch unkategorisierten Einträge. */
function _taxCurrentSuggestions() {
  if (typeof _getAllEntries !== 'function' || typeof taxSeedSuggestions !== 'function') return [];
  return taxSeedSuggestions(_getAllEntries());
}

/** HTML-Block „Vorschläge“ (leer, wenn es keine gibt). */
function _taxSeedHtml(suggestions) {
  if (!suggestions.length) return '';
  const head = `<div class="tax-seed">
      <span class="tax-seed-text"><strong>${suggestions.length}</strong> Vorschlag${suggestions.length !== 1 ? 'e' : ''} aus der Wortliste für unkategorisierte Einträge</span>
      <button type="button" class="btn btn-secondary btn-sm" data-tax-action="seed-toggle">${_taxSeedOpen ? 'Vorschau schließen' : 'Vorschau'}</button>
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
      <button type="button" class="btn btn-primary btn-sm" data-tax-action="seed-apply">Auswahl übernehmen</button>
      <button type="button" class="btn btn-secondary btn-sm" data-tax-action="seed-all">Alle</button>
      <button type="button" class="btn btn-secondary btn-sm" data-tax-action="seed-none">Keine</button>
    </div>
    <p class="help-text">Es werden nur Einträge ohne Hauptkategorie ergänzt; vorhandene Zuordnungen bleiben unberührt.</p>`;
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

/** Einträge, deren Kategorie-IDs in der Taxonomie nicht (mehr) existieren. */
function _taxUnknownRefs() {
  if (typeof _getAllEntries !== 'function') return [];
  return _getAllEntries().filter(({ entry }) => {
    const s = entry && entry.semantik;
    if (!s) return false;
    return (s.primaer && !taxIsKnown(s.primaer)) || (Array.isArray(s.weitere) && s.weitere.some(id => !taxIsKnown(id)));
  });
}

/**
 * Das Panel wird bei jeder Änderung komplett neu gerendert. Damit der Tastaturfokus dabei nicht
 * verloren geht (Teilbaum-Checkbox, Vorschau-Schalter, …), wird das fokussierte Steuerelement
 * vor dem Rendern beschrieben und danach wiederhergestellt – nur wenn der Fokus im Panel lag.
 */
function _taxFocusSnapshot(host) {
  const el = document.activeElement;
  if (!el || !host.contains(el)) return null;
  const row = el.closest('.tax-row');
  const act = el.closest('[data-tax-action]');
  return {
    rowId: row ? row.dataset.id : null,
    action: act ? act.dataset.taxAction : null,
    seed: el.matches('.seed-pick') ? `${el.dataset.wortart}\u0000${el.dataset.key}` : null,
    summary: el.matches('summary'),
  };
}

/** Fokussiert (id, action) im Panel; sucht sonst Ersatzziele. Gibt zurück, ob etwas fokussiert wurde. */
function _taxFocusControl(host, { rowId = null, action = null, seed = null, summary = false } = {}) {
  const q = (sel) => host.querySelector(sel);
  const esc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
  let el = null;
  if (seed) el = Array.from(host.querySelectorAll('.seed-pick')).find(cb => `${cb.dataset.wortart}\u0000${cb.dataset.key}` === seed);
  else if (summary) el = q('summary');
  else if (rowId && action) {
    const row = `.tax-row[data-id="${esc(rowId)}"]`;
    // Zeile bleibt, gewünschte Aktion nicht (z. B. Toggle einer Kategorie ohne Unterkategorien) → erste Aktion der Zeile
    el = q(`${row} [data-tax-action="${action}"]:not(:disabled)`) || q(`${row} [data-tax-action]:not(:disabled)`);
  } else if (action) el = q(`[data-tax-action="${action}"]:not(:disabled)`);
  if (!el) el = q('summary');
  if (el) { el.focus(); return true; }
  return false;
}

/**
 * Rekursive Darstellung des Kategorienbaums. Die Nummerierung („1.“, „1.2“, „1.2.3“) wird bei jedem
 * Rendern aus Geschwisterposition und Nummerierungspfad abgeleitet – sie ist weder Teil des Datenmodells
 * noch der Export-JSON und wird nie als Kennung verwendet (dafür dient data-id).
 *
 * Struktur je Kategorie (Hinweis: keine interaktiven Elemente in <summary>/<button>-Inhalt):
 *   li.tax-node
 *     div.tax-row[data-id]         ← Kopfzeile: Toggle (Button bzw. statisch) + Aktionsgruppe nebeneinander
 *     ul.tax-children#…[hidden]    ← Unterkategorien (nur wenn vorhanden)
 */
function _taxTreeHtml(parentId, numberPath, nodes, counts) {
  const kids = taxChildren(parentId, nodes);
  if (!kids.length) return '';
  return kids.map((node, i) => _taxNodeHtml(node, [...numberPath, i + 1], nodes, counts)).join('');
}

function _taxNodeHtml(node, numberPath, nodes, counts) {
  const n = counts.get(node.id) || 0;
  const name = escHtml(node.name);
  const level = numberPath.length;
  const full = level >= TAX_MAX_DEPTH;              // Ebene 5 erreicht: keine weitere Unterkategorie
  const num = numberPath.join('.') + (level === 1 ? '.' : '');
  const hasKids = taxChildren(node.id, nodes).length > 0;
  const open = hasKids && _taxOpenIds.has(node.id);
  const subId = `tax-sub-${escHtml(node.id)}`;

  const label = `
          <span class="tax-num">${num}</span>
          <span class="tax-name${node.eigen ? ' tax-own' : ''}">${name}</span>
          ${n ? `<span class="stat-pill stat-pill--active" title="Einträge mit dieser Hauptkategorie">${n}</span>` : ''}`;
  const toggle = hasKids
    ? `<button type="button" class="tax-toggle" data-tax-action="toggle" aria-expanded="${open}" aria-controls="${subId}"
              title="Unterkategorien von „${name}“ ein-/ausklappen">${label}
          <span class="acc-chevron" aria-hidden="true">${icon('chevron-down', 14)}</span>
        </button>`
    : `<div class="tax-toggle tax-toggle--static">${label}</div>`;

  return `
    <li class="tax-node" data-level="${level}">
      <div class="tax-row" data-id="${escHtml(node.id)}">
        ${toggle}
        <div class="tax-actions" role="group" aria-label="Aktionen für „${name}“">
          <label class="tax-flag" title="Teilbaum blockieren: alle Einträge unterhalb dieser Kategorie gelten als gleichartig">
            <input type="checkbox" data-tax-action="flag" ${node.blockiereTeilbaum ? 'checked' : ''}
                   aria-label="Teilbaum von „${name}“ blockieren"> <span>Teilbaum</span>
          </label>
          <button type="button" class="btn btn-icon" data-tax-action="add" ${full ? 'disabled' : ''}
                  title="${full ? `Maximal ${TAX_MAX_DEPTH} Ebenen` : 'Unterkategorie anlegen'}"
                  aria-label="Unterkategorie zu „${name}“ anlegen">+</button>
          <button type="button" class="btn btn-icon" data-tax-action="rename" title="Umbenennen"
                  aria-label="„${name}“ umbenennen">${icon('edit-2', 14)}</button>
          <button type="button" class="btn btn-icon btn-danger-quiet" data-tax-action="remove" title="Löschen"
                  aria-label="„${name}“ löschen">${icon('trash-2', 14)}</button>
        </div>
      </div>
      ${hasKids ? `<ul class="tax-tree tax-children" id="${subId}" ${open ? '' : 'hidden'}>${_taxTreeHtml(node.id, numberPath, nodes, counts)}</ul>` : ''}
    </li>`;
}

/** Klappt eine Kategorie auf/zu, ohne neu zu rendern (Fokus und Scrollposition bleiben). */
function _taxToggleNode(btn, id) {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  const sub = document.getElementById(btn.getAttribute('aria-controls'));
  if (sub) sub.hidden = !open;
  if (open) _taxOpenIds.add(id); else _taxOpenIds.delete(id);
}

function renderTaxonomyPanel() {
  const host = document.getElementById('taxonomyPanel');
  if (!host) return;
  const focusSnap = _taxFocusSnapshot(host);

  const counts = _taxCountByPrimary();
  const entries = (typeof _getAllEntries === 'function') ? _getAllEntries() : [];
  const uncategorized = entries.filter(({ entry }) => !(entry.semantik && entry.semantik.primaer)).length;

  const nodes = taxGetNodes();
  [..._taxOpenIds].forEach(id => { if (!nodes.has(id)) _taxOpenIds.delete(id); });
  const tree = _taxTreeHtml(null, [], nodes, counts);

  // Hinweise: Migration (einmalig) und zu tiefe Kategorien (solange vorhanden)
  const notes = [...TAX_MIGRATION_NOTES.filter(m => !/tiefer als/.test(m)), ...taxDepthNotes()];
  const noticeHtml = notes.length ? `
      <div class="tax-notice" role="status">
        ${notes.map(m => `<p>${escHtml(m)}</p>`).join('')}
        ${TAX_MIGRATION_NOTES.length ? '<button type="button" class="btn btn-secondary btn-sm" data-tax-action="dismiss-notes">Hinweise ausblenden</button>' : ''}
      </div>` : '';

  const unknown = _taxUnknownRefs();
  const unknownHtml = unknown.length ? `
      <div class="tax-notice tax-notice-warn" role="alert">
        <p><strong>${unknown.length}</strong> Eintrag/Einträge verweisen auf Kategorien, die es nicht (mehr) gibt
           (z. B. aufgelöste Beinamen). Die Zuordnung bleibt unverändert, bis du sie neu wählst.</p>
        <button type="button" class="btn btn-secondary btn-sm" data-tax-action="fix-unknown">Unbekannte Zuordnungen aufheben</button>
      </div>` : '';

  const open = host.querySelector('details.tax-card')?.open ? ' open' : '';
  host.innerHTML = `
    <details class="acc tax-card"${open}>
      <summary class="acc-summary">
        <span class="acc-icon" aria-hidden="true">${icon('list-tree', 15)}</span>
        <span class="acc-heading">
          <span class="acc-title">Semantische Kategorien</span>
          ${entries.length ? `<span class="acc-hint">${uncategorized} von ${entries.length} Einträgen ohne Hauptkategorie</span>` : ''}
        </span>
        <span class="acc-chevron" aria-hidden="true">${icon('chevron-down', 14)}</span>
      </summary>
      <div class="acc-body">
        <p class="help-text">
          Gleiche Hauptkategorie = semantisch redundant (z. B. <em>Rubin</em> + <em>Smaragd</em>); der Namensgenerator
          kombiniert sie nicht. Einträge ohne Kategorie blockieren nie. Es sind höchstens ${TAX_MAX_DEPTH} Ebenen möglich.
        </p>
        ${noticeHtml}${unknownHtml}
        ${_taxSeedHtml(_taxCurrentSuggestions())}
        <ul class="tax-tree tax-tree--root" aria-label="Kategorienbaum">${tree}</ul>
        <div class="tax-footer">
          <button type="button" class="btn btn-secondary btn-sm" data-tax-action="add-root">+ Oberkategorie</button>
          <button type="button" class="btn btn-secondary btn-sm" data-tax-action="reset">Standard wiederherstellen</button>
        </div>
      </div>
    </details>`;

  if (focusSnap) _taxFocusControl(host, focusSnap);
}

/** Nach einem Dialog: Fokus zurück ins Panel, falls er (durch Neu-Rendern) verloren ging. */
function _taxEnsureFocus(target, force = false) {
  const host = document.getElementById('taxonomyPanel');
  if (!host || (!force && host.contains(document.activeElement))) return;
  _taxFocusControl(host, target);
}

async function _taxHandleClick(e) {
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
  if (action === 'dismiss-notes') { taxClearMigrationNotes(); renderTaxonomyPanel(); return; }
  if (action === 'fix-unknown') { await _taxFixUnknownRefs(); return; }

  try {
    switch (action) {
      case 'toggle':
        _taxToggleNode(el, id);
        return;
      case 'flag':
        taxSetBlockSubtree(id, el.checked);
        return;
      case 'add-root': {
        // Anlegen läuft im Dialog (`submit`): Fehler (z. B. doppelter Name) erscheinen dort, der Dialog bleibt offen.
        await appDialog.prompt({
          title: 'Neue Oberkategorie', label: 'Name der neuen Oberkategorie', confirmLabel: 'Anlegen',
          submit: (name) => taxAddNode(null, name),
        });
        _taxEnsureFocus({ action: 'add-root' });
        return;
      }
      case 'add': {
        const parentName = taxGetNodes().get(id).name;
        await appDialog.prompt({
          title: 'Neue Unterkategorie', label: `Neue Unterkategorie unter „${parentName}“`, confirmLabel: 'Anlegen',
          // Elternkategorie vor dem Anlegen aufklappen: taxAddNode rendert synchron, die neue Unterkategorie soll sichtbar sein
          submit: (name) => {
            const wasOpen = _taxOpenIds.has(id);
            _taxOpenIds.add(id);
            try { return taxAddNode(id, name); } catch (err) { if (!wasOpen) _taxOpenIds.delete(id); throw err; }
          },
        });
        _taxEnsureFocus({ rowId: id, action: 'add' });
        return;
      }
      case 'rename': {
        await appDialog.prompt({
          title: 'Kategorie umbenennen', label: 'Neuer Name', value: taxGetNodes().get(id).name, confirmLabel: 'Umbenennen',
          submit: (name) => taxRenameNode(id, name),
        });
        _taxEnsureFocus({ rowId: id, action: 'rename' });
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
        const ok = await appDialog.confirm({
          title: 'Kategorie löschen',
          message: `„${node.name}“${doomed.size > 1 ? ` samt ${doomed.size - 1} Unterkategorie(n)` : ''} löschen?`,
          detail: affected ? `${affected} Eintrag/Einträge betroffen: ` +
            (target ? `die Hauptkategorie wechselt zu ${target}.` : 'sie verlieren die Hauptkategorie.') : '',
          confirmLabel: 'Kategorie löschen', danger: true,
        });
        if (ok) { doomed.forEach(d => _taxOpenIds.delete(d)); taxRemoveNode(id, parent); }
        // Zeile existiert nach dem Löschen nicht mehr → Fokus auf die übergeordnete Kategorie bzw. die Fußzeile
        // force: das Neu-Rendern hat den Fokus sonst auf den Ersatz „summary“ gesetzt
        _taxEnsureFocus(ok && parent ? { rowId: parent, action: 'rename' } : ok ? { action: 'add-root' } : { rowId: id, action: 'remove' }, ok);
        return;
      }
      case 'reset': {
        const ok = await appDialog.confirm({
          title: 'Standard-Taxonomie wiederherstellen',
          message: 'Standard-Taxonomie wiederherstellen? Eigene Kategorien und Umbenennungen gehen verloren; Zuordnungen auf entfernte Kategorien werden aufgehoben.',
          confirmLabel: 'Wiederherstellen', danger: true,
        });
        if (ok) {
          const before = new Set(taxGetNodes().keys());
          taxReset();
          const after = taxGetNodes();
          const gone = [...before].filter(k => !after.has(k));
          if (gone.length && typeof _getAllEntries === 'function') {
            taxRepairEntries(_getAllEntries().map(x => x.entry), gone, null);
          }
          if (typeof _refreshAfterEdit === 'function') _refreshAfterEdit();
        }
        _taxEnsureFocus({ action: 'reset' });
        return;
      }
    }
  } catch (err) {
    showToast(err.message);
  }
}

/** Hebt Zuordnungen auf unbekannte Kategorien auf (nach Bestätigung); bekannte bleiben erhalten. */
async function _taxFixUnknownRefs() {
  const list = _taxUnknownRefs();
  if (!list.length) return;
  const ok = await appDialog.confirm({
    title: 'Unbekannte Zuordnungen aufheben',
    message: `${list.length} Eintrag/Einträge: unbekannte Kategorie-Zuordnungen entfernen?`,
    confirmLabel: 'Zuordnungen aufheben', danger: true,
  });
  if (!ok) { _taxEnsureFocus({ action: 'fix-unknown' }); return; }
  let n = 0;
  list.forEach(({ key, entry }) => {
    const copy = JSON.parse(JSON.stringify(entry));
    const sem = copy.semantik;
    entrySetSemantik(copy,
      taxIsKnown(sem.primaer) ? sem.primaer : null,
      (sem.weitere || []).filter(id => taxIsKnown(id)));
    const panel = _panels.get(entry.wortart);
    if (panel && panel.updateEntry(key, copy)) n++;
  });
  showToast(`${n} Eintrag${n !== 1 ? 'e' : ''} bereinigt`);
  _refreshAfterEdit();
  _taxEnsureFocus({ action: 'add-root' }, true);
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
