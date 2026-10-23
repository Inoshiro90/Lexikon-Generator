/**
 * taxonomy.js
 * Semantische Taxonomie: Zustand, Persistenz, Pflege und Regelwerk.
 *
 * Datenmodell
 * - Knoten: { id, name, parent, eigen, blockiereTeilbaum }
 *   (id stabil, name frei umbenennbar, parent = id | null)
 * - Eintragszuordnung: entry.semantik = { primaer: id|null, weitere: [id] }
 *
 * Regel (Redundanz)
 * - Nur die PRIMAERkategorie blockiert; "weitere" Kategorien nie.
 * - Zwei Eintraege kollidieren, wenn ihre Primaerkategorien derselbe Knoten
 *   sind oder beide im Teilbaum eines Knotens mit blockiereTeilbaum liegen.
 * - Eintraege ohne (bekannte) Kategorie blockieren nie.
 *
 * Reine Funktionen, kein DOM-Zugriff (testbar unter Node).
 * Benoetigt: taxonomy-default.js (TAXONOMY_DEFAULT_NODES).
 */

/* eslint-disable no-unused-vars */

const TAX_STORAGE_KEY = 'lexikon-taxonomie-v1';
const TAX_VERSION = 1;
const TAX_SEPARATOR = ' > ';

/** @type {Map<string, {id:string,name:string,parent:string|null,eigen:boolean,blockiereTeilbaum:boolean}>|null} */
let _taxNodes = null;

/** Warnungen des laufenden Imports (werden vom Import-Panel ausgelesen). */
let TAX_IMPORT_WARNINGS = [];

const _taxListeners = [];

// ── Zustand ──────────────────────────────────────────────────

function taxDefaultIds() {
	return new Set(TAXONOMY_DEFAULT_NODES.map(n => n[0]));
}

function taxDefaultNodes() {
	const map = new Map();
	for (const [id, name, parent] of TAXONOMY_DEFAULT_NODES) {
		map.set(id, { id, name, parent, eigen: false, blockiereTeilbaum: false });
	}
	return map;
}

/** Laedt gespeicherte Taxonomie (localStorage) oder den Standardbaum. */
function taxInit() {
	let nodes = null;
	try {
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(TAX_STORAGE_KEY);
			if (raw) nodes = taxDeserialize(JSON.parse(raw));
		}
	} catch (e) {
		nodes = null;
	}
	_taxNodes = (nodes && nodes.size > 0) ? nodes : taxDefaultNodes();
	return _taxNodes;
}

function taxGetNodes() {
	if (!_taxNodes) taxInit();
	return _taxNodes;
}

function taxSetNodes(nodes, silent) {
	_taxNodes = nodes;
	taxPersist();
	if (!silent) taxEmit({ type: 'replace' });
}

function taxReset() {
	_taxNodes = taxDefaultNodes();
	taxPersist();
	taxEmit({ type: 'reset' });
}

function taxPersist() {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(TAX_STORAGE_KEY, JSON.stringify(taxSerialize(taxGetNodes())));
		}
	} catch (e) { /* Speicher nicht verfuegbar: nur fuer diese Sitzung */ }
}

function taxOnChange(fn) { _taxListeners.push(fn); }

function taxEmit(evt) {
	for (const fn of _taxListeners) {
		try { fn(evt); } catch (e) { console.error(e); }
	}
}

// ── Abfragen ─────────────────────────────────────────────────

function taxIsKnown(id, nodes) {
	return !!id && (nodes || taxGetNodes()).has(id);
}

function taxChildren(id, nodes) {
	const out = [];
	for (const n of (nodes || taxGetNodes()).values()) {
		if (n.parent === id) out.push(n);
	}
	return out;
}

/** Pfad Wurzel → Knoten als id-Liste (leer bei unbekannter id). */
function taxPath(id, nodes) {
	const map = nodes || taxGetNodes();
	const path = [];
	const seen = new Set();
	let cur = id;
	while (cur && map.has(cur) && !seen.has(cur)) {
		seen.add(cur);
		path.unshift(cur);
		cur = map.get(cur).parent;
	}
	return path;
}

/** Anzeigepfad, z. B. "Material > Edelstein". Unbekannte ids bleiben lesbar. */
function taxLabel(id, nodes) {
	if (!id) return '';
	const map = nodes || taxGetNodes();
	const path = taxPath(id, map);
	if (path.length === 0) return String(id);
	return path.map(p => map.get(p).name).join(TAX_SEPARATOR);
}

/** Alle Knoten in Baumreihenfolge (Eltern vor Kindern) mit Tiefe. */
function taxFlatten(nodes) {
	const map = nodes || taxGetNodes();
	const out = [];
	const walk = (parent, depth) => {
		for (const n of map.values()) {
			if (n.parent === parent) {
				out.push({ node: n, depth });
				walk(n.id, depth + 1);
			}
		}
	};
	walk(null, 0);
	return out;
}

// ── Regel ────────────────────────────────────────────────────

/**
 * Kollidieren zwei Primaerkategorien (semantisch redundant)?
 * Gleicher Knoten ODER gemeinsamer Vorfahr mit blockiereTeilbaum.
 */
function taxCollides(idA, idB, nodes) {
	const map = nodes || taxGetNodes();
	if (!idA || !idB) return false;
	if (!map.has(idA) || !map.has(idB)) return false;
	if (idA === idB) return true;
	const pathB = new Set(taxPath(idB, map));
	for (const anc of taxPath(idA, map)) {
		if (pathB.has(anc) && map.get(anc).blockiereTeilbaum) return true;
	}
	return false;
}

// ── Pflege ───────────────────────────────────────────────────

function taxSlug(name) {
	return String(name).toLowerCase()
		.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kategorie';
}

function taxCheckName(name, parentId, selfId, nodes) {
	const n = String(name == null ? '' : name).trim();
	if (!n) throw new Error('Der Name darf nicht leer sein.');
	if (/[,>]/.test(n)) throw new Error('Der Name darf weder „,“ noch „>“ enthalten.');
	for (const other of nodes.values()) {
		if (other.id !== selfId && other.parent === parentId && other.name.toLowerCase() === n.toLowerCase()) {
			throw new Error(`Unter dieser Oberkategorie gibt es bereits „${other.name}“.`);
		}
	}
	return n;
}

/** Legt eine eigene Kategorie an und gibt ihre id zurueck. */
function taxAddNode(parentId, name) {
	const nodes = taxGetNodes();
	if (parentId && !nodes.has(parentId)) throw new Error('Unbekannte Oberkategorie.');
	const clean = taxCheckName(name, parentId || null, null, nodes);
	const base = (parentId ? parentId + '.' : '') + taxSlug(clean);
	let id = base, i = 2;
	while (nodes.has(id)) id = base + '-' + (i++);
	nodes.set(id, { id, name: clean, parent: parentId || null, eigen: !taxDefaultIds().has(id), blockiereTeilbaum: false });
	taxPersist();
	taxEmit({ type: 'add', id });
	return id;
}

function taxRenameNode(id, name) {
	const nodes = taxGetNodes();
	const node = nodes.get(id);
	if (!node) throw new Error('Unbekannte Kategorie.');
	node.name = taxCheckName(name, node.parent, id, nodes);
	taxPersist();
	taxEmit({ type: 'rename', id });
}

function taxSetBlockSubtree(id, value) {
	const node = taxGetNodes().get(id);
	if (!node) throw new Error('Unbekannte Kategorie.');
	node.blockiereTeilbaum = !!value;
	taxPersist();
	taxEmit({ type: 'flag', id });
}

/**
 * Entfernt einen Knoten samt Unterknoten. Eintraege, die darauf zeigten,
 * werden durch die Listener umgehaengt (replacementId) oder verlieren die
 * Zuordnung (replacementId = null).
 * @returns {string[]} entfernte ids
 */
function taxRemoveNode(id, replacementId) {
	const nodes = taxGetNodes();
	if (!nodes.has(id)) throw new Error('Unbekannte Kategorie.');
	const doomed = new Set([id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const n of nodes.values()) {
			if (n.parent && doomed.has(n.parent) && !doomed.has(n.id)) { doomed.add(n.id); grew = true; }
		}
	}
	const repl = (replacementId && nodes.has(replacementId) && !doomed.has(replacementId)) ? replacementId : null;
	for (const d of doomed) nodes.delete(d);
	taxPersist();
	taxEmit({ type: 'remove', removed: [...doomed], replacement: repl });
	return [...doomed];
}

// ── Serialisierung ───────────────────────────────────────────

/** Export-Form: { version, knoten: { id: { name, parent, eigen?, blockiereTeilbaum? } } } */
function taxSerialize(nodes) {
	const map = nodes || taxGetNodes();
	const defaults = taxDefaultIds();
	const knoten = {};
	for (const { node } of taxFlatten(map)) {
		const o = { name: node.name, parent: node.parent };
		if (!defaults.has(node.id)) o.eigen = true;
		if (node.blockiereTeilbaum) o.blockiereTeilbaum = true;
		knoten[node.id] = o;
	}
	return { version: TAX_VERSION, knoten };
}

/** Baut eine Knoten-Map aus der Export-Form. Ungueltiges wird verworfen. */
function taxDeserialize(obj, warnings) {
	const out = new Map();
	if (!obj || typeof obj !== 'object' || !obj.knoten || typeof obj.knoten !== 'object') return out;
	const warn = m => { if (warnings) warnings.push(m); };
	const defaults = taxDefaultIds();
	const pending = Object.entries(obj.knoten).filter(([id, v]) => {
		if (!v || typeof v !== 'object' || typeof v.name !== 'string' || !v.name.trim()) {
			warn(`Kategorie „${id}“ ohne Namen übersprungen.`);
			return false;
		}
		return true;
	});
	let progress = true;
	while (pending.length && progress) {
		progress = false;
		for (let i = pending.length - 1; i >= 0; i--) {
			const [id, v] = pending[i];
			const parent = v.parent == null ? null : String(v.parent);
			if (parent === null || out.has(parent)) {
				out.set(id, {
					id, name: v.name.trim(), parent,
					eigen: v.eigen === true || !defaults.has(id),
					blockiereTeilbaum: v.blockiereTeilbaum === true
				});
				pending.splice(i, 1);
				progress = true;
			}
		}
	}
	for (const [id] of pending) warn(`Kategorie „${id}“ hat eine unbekannte Oberkategorie und wurde übersprungen.`);
	// Reihenfolge: Eltern vor Kindern (Map-Einfuegereihenfolge bei Rueckwaertslauf umkehren)
	const sorted = new Map();
	for (const { node } of taxFlatten(out)) sorted.set(node.id, node);
	return sorted;
}

/**
 * Uebernimmt eine importierte Taxonomie in die aktuelle: unbekannte Knoten
 * werden ergaenzt, vorhandene bleiben unveraendert.
 * @returns {number} Anzahl neu ergaenzter Knoten
 */
function taxMergeSerialized(obj, warnings) {
	const incoming = taxDeserialize(obj, warnings);
	const nodes = taxGetNodes();
	let added = 0;
	for (const { node } of taxFlatten(incoming)) {
		if (!nodes.has(node.id)) {
			if (node.parent && !nodes.has(node.parent)) continue;
			nodes.set(node.id, { ...node });
			added++;
		}
	}
	if (added) { taxPersist(); taxEmit({ type: 'merge', added }); }
	return added;
}

/** Strukturpruefung (Zyklen, fehlende Eltern, Namen). */
function taxValidate(nodes) {
	const map = nodes || taxGetNodes();
	const errors = [];
	for (const n of map.values()) {
		if (n.parent && !map.has(n.parent)) errors.push(`„${n.id}“: Oberkategorie „${n.parent}“ fehlt.`);
		if (!n.name || /[,>]/.test(n.name)) errors.push(`„${n.id}“: ungültiger Name.`);
		const seen = new Set();
		let cur = n.id;
		while (cur && map.has(cur)) {
			if (seen.has(cur)) { errors.push(`„${n.id}“: Zyklus in der Hierarchie.`); break; }
			seen.add(cur);
			cur = map.get(cur).parent;
		}
	}
	return errors;
}

// ── Aufloesen von Referenzen (Import) ────────────────────────

/**
 * Loest "material.edelstein", "Material > Edelstein" oder einen eindeutigen
 * Namen ("Edelstein") zu einer id auf. Unbekannt/mehrdeutig → null.
 */
function taxResolveRef(ref, nodes) {
	const map = nodes || taxGetNodes();
	const s = String(ref == null ? '' : ref).trim();
	if (!s) return null;
	if (map.has(s)) return s;
	const low = s.toLowerCase();
	for (const id of map.keys()) if (id.toLowerCase() === low) return id;
	const norm = t => t.split('>').map(p => p.trim().toLowerCase()).join('>');
	const wanted = norm(s);
	const byPath = [...map.keys()].filter(id => norm(taxLabel(id, map)) === wanted);
	if (byPath.length === 1) return byPath[0];
	if (!wanted.includes('>')) {
		const byName = [...map.values()].filter(n => n.name.toLowerCase() === low);
		if (byName.length === 1) return byName[0].id;
	}
	return null;
}

function taxWarn(msg) {
	if (TAX_IMPORT_WARNINGS.length < 200) TAX_IMPORT_WARNINGS.push(msg);
}

function taxResetImportWarnings() { TAX_IMPORT_WARNINGS = []; }

/**
 * Normalisiert { primaer, weitere } (ids oder Pfade) gegen die Taxonomie.
 * @returns {{primaer:string|null, weitere:string[]}|null} null, wenn nichts bleibt
 */
function taxNormalizeSemantik(sem, key, nodes) {
	if (!sem || typeof sem !== 'object') return null;
	const map = nodes || taxGetNodes();
	const label = key ? `„${key}“: ` : '';
	let primaer = null;
	if (sem.primaer != null && String(sem.primaer).trim() !== '') {
		primaer = taxResolveRef(sem.primaer, map);
		if (!primaer) taxWarn(`${label}Kategorie „${sem.primaer}“ unbekannt – ohne Kategorie übernommen.`);
	}
	const weitere = [];
	const list = Array.isArray(sem.weitere) ? sem.weitere : [];
	for (const w of list) {
		if (w == null || String(w).trim() === '') continue;
		const id = taxResolveRef(w, map);
		if (!id) { taxWarn(`${label}weitere Kategorie „${w}“ unbekannt – ignoriert.`); continue; }
		if (id !== primaer && !weitere.includes(id)) weitere.push(id);
	}
	if (!primaer && weitere.length === 0) return null;
	return { primaer, weitere };
}

/**
 * Liest die Kategorie aus einer flachen Importzeile.
 * Unterstuetzt: row.semantik (Objekt) oder row.kategorie / row.kategorie_weitere
 * (Text, mehrere weitere Kategorien mit Komma getrennt).
 */
function taxSemantikFromRow(row, key) {
	if (!row) return null;
	let sem = null;
	if (row.semantik && typeof row.semantik === 'object') {
		sem = row.semantik;
	} else {
		const p = row.kategorie != null ? String(row.kategorie).trim() : '';
		const w = row.kategorie_weitere != null ? String(row.kategorie_weitere).trim() : '';
		if (!p && !w) return null;
		sem = { primaer: p, weitere: w ? w.split(',') : [] };
	}
	return taxNormalizeSemantik(sem, key);
}

/**
 * Uebertraegt Zusatzinformationen der Zeile auf den Eintrag:
 * entry.semantik (aus Kategorie-Spalten bzw. JSON) und unbekannte Felder
 * aus row.__extra (damit kuenftig ergaenzte Metadaten den Roundtrip ueberstehen).
 */
function taxApplyToEntry(entry, row, key) {
	const sem = taxSemantikFromRow(row, key);
	if (sem) entry.semantik = sem;
	if (row && row.__extra && typeof row.__extra === 'object') {
		for (const k of Object.keys(row.__extra)) {
			if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
			if (!(k in entry)) entry[k] = row.__extra[k];
		}
	}
	return entry;
}

/** Eintrag → Tabellenzellen (fuer Vorlagen/Anzeige). */
function taxSemantikToCells(sem) {
	if (!sem) return { kategorie: '', kategorie_weitere: '' };
	return {
		kategorie: sem.primaer ? taxLabel(sem.primaer) : '',
		kategorie_weitere: (sem.weitere || []).map(id => taxLabel(id)).join(', ')
	};
}

/** Haengt Eintraege um/entfernt Zuordnungen nach dem Loeschen von Knoten. */
function taxRepairEntries(entries, removedIds, replacementId) {
	const gone = new Set(removedIds);
	let touched = 0;
	for (const e of entries) {
		const s = e && e.semantik;
		if (!s) continue;
		let changed = false;
		if (s.primaer && gone.has(s.primaer)) { s.primaer = replacementId || null; changed = true; }
		if (Array.isArray(s.weitere)) {
			const kept = s.weitere.filter(id => !gone.has(id) && id !== s.primaer);
			if (kept.length !== s.weitere.length) { s.weitere = kept; changed = true; }
		}
		if (!s.primaer && (!s.weitere || s.weitere.length === 0)) delete e.semantik;
		if (changed) touched++;
	}
	return touched;
}

// ── Vorschläge (taxonomy-seed.js) ────────────────────────────

/**
 * Vorschlag für ein Wort aus der Seed-Tabelle. Nur Kategorien, die in der aktuellen
 * Taxonomie existieren, werden vorgeschlagen (gelöschte/umbenannte IDs werden übergangen).
 * @returns {{primaer:string, weitere:string[]}|null}
 */
function taxSeedLookup(key, nodes) {
  if (typeof TAXONOMY_SEED === 'undefined' || key == null) return null;
  const k = String(key).trim().toLowerCase();
  if (!k || !Object.prototype.hasOwnProperty.call(TAXONOMY_SEED, k)) return null;
  const map = nodes || taxGetNodes();
  const [primaer, ...weitere] = TAXONOMY_SEED[k];
  if (!map.has(primaer)) return null;
  return { primaer, weitere: weitere.filter(id => map.has(id) && id !== primaer) };
}

/**
 * Vorschläge für alle Einträge ohne Hauptkategorie.
 * Vorhandene Hauptkategorien werden nie überschrieben.
 * @param {{key:string, entry:Object}[]} entries
 * @returns {{key:string, wortart:string, primaer:string, weitere:string[]}[]}
 */
function taxSeedSuggestions(entries, nodes) {
  const out = [];
  for (const { key, entry } of entries) {
    if (entry && entry.semantik && entry.semantik.primaer) continue;
    const hit = taxSeedLookup(key, nodes);
    if (!hit) continue;
    const have = (entry.semantik && Array.isArray(entry.semantik.weitere)) ? entry.semantik.weitere : [];
    const weitere = [...new Set([...have, ...hit.weitere])].filter(id => id !== hit.primaer);
    out.push({ key, wortart: entry.wortart, primaer: hit.primaer, weitere });
  }
  return out;
}

/** Liefert eine Kopie des Eintrags mit übernommenem Vorschlag. */
function taxSeedApply(entry, suggestion) {
  const copy = JSON.parse(JSON.stringify(entry));
  copy.semantik = { primaer: suggestion.primaer, weitere: [...suggestion.weitere] };
  return copy;
}
