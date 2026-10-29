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
const TAX_VERSION = 2;
/** Die Tabelle zeigt höchstens diese Anzahl Ebenen (Kategorie_1 … Kategorie_5). */
const TAX_MAX_DEPTH = 5;
const TAX_SEPARATOR = ' > ';

/** @type {Map<string, {id:string,name:string,parent:string|null,eigen:boolean,blockiereTeilbaum:boolean}>|null} */
let _taxNodes = null;

/** Warnungen des laufenden Imports (werden vom Import-Panel ausgelesen). */
let TAX_IMPORT_WARNINGS = [];

/** Hinweise zur Migration einer gespeicherten Taxonomie (einmalig im Panel angezeigt). */
let TAX_MIGRATION_NOTES = [];

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

/**
 * Laedt gespeicherte Taxonomie (localStorage) oder den Standardbaum.
 * Aeltere Staende (Version < 2 bzw. mit der aufgeloesten Oberkategorie „Goettliches“)
 * werden gezielt migriert; Hinweise stehen danach in TAX_MIGRATION_NOTES.
 */
function taxInit() {
	let nodes = null;
	TAX_MIGRATION_NOTES = [];
	try {
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(TAX_STORAGE_KEY);
			if (raw) {
				const stored = JSON.parse(raw);
				const version = Number(stored && stored.version) || 1;
				const mig = taxMigrateSerialized(stored, { addNewDefaults: version < TAX_VERSION });
				const warnings = [];
				nodes = taxDeserialize(mig.obj, warnings);
				TAX_MIGRATION_NOTES.push(...mig.notes, ...warnings);
				if (nodes.size > 0) {
					TAX_MIGRATION_NOTES.push(...taxDepthNotes(nodes));
					_taxNodes = nodes;
					if (mig.changed || version < TAX_VERSION) taxPersist();   // migrierten Stand sichern
				}
			}
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

/** Migrationshinweise als gelesen markieren (Panel blendet sie aus). */
function taxClearMigrationNotes() { TAX_MIGRATION_NOTES = []; }

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

// ── Ebenen (Tabellenspalten Kategorie_1 … Kategorie_5) ───────

/** Tiefe eines Knotens (Wurzel = 1; 0 bei unbekannter id). */
function taxDepth(id, nodes) {
	return taxPath(id, nodes).length;
}

/** Hinweise zu Kategorien, die tiefer als TAX_MAX_DEPTH liegen (nichts wird veraendert). */
function taxDepthNotes(nodes) {
	const map = nodes || taxGetNodes();
	const deep = [...map.keys()].filter(id => taxDepth(id, map) > TAX_MAX_DEPTH);
	if (!deep.length) return [];
	return [`${deep.length} Kategorie(n) liegen tiefer als ${TAX_MAX_DEPTH} Ebenen (z. B. „${taxLabel(deep[0], map)}“). ` +
		`Die Tabelle zeigt nur ${TAX_MAX_DEPTH} Ebenen; die Zuordnung bleibt erhalten. Neue Kategorien dieser Tiefe sind nicht möglich.`];
}

/**
 * Pfad einer Kategorie als Spaltenwerte.
 * @returns {{ levels: ({id:string,name:string}|null)[], deep: boolean, unknown: boolean }}
 *   levels hat immer genau `count` Eintraege; deep = Pfad laenger als count;
 *   unknown = id ist gesetzt, existiert aber nicht in der Taxonomie.
 */
function taxPathColumns(id, nodes, count) {
	const map = nodes || taxGetNodes();
	const n = count || TAX_MAX_DEPTH;
	const levels = new Array(n).fill(null);
	if (!id) return { levels, deep: false, unknown: false };
	const path = taxPath(id, map);
	if (!path.length) return { levels, deep: false, unknown: true };
	path.slice(0, n).forEach((pid, i) => { levels[i] = { id: pid, name: map.get(pid).name }; });
	return { levels, deep: path.length > n, unknown: false };
}

/**
 * Auswahlmoeglichkeiten fuer eine Ebene (1-basiert) bei bisheriger Auswahl.
 * Ebene 1: Oberkategorien; Ebene n: direkte Kinder der Auswahl auf Ebene n-1.
 * @param {number} level
 * @param {string[]} selection  Kategorie-ids je Ebene ('' = leer)
 */
function taxColumnOptions(level, selection, nodes) {
	const map = nodes || taxGetNodes();
	if (level === 1) return taxChildren(null, map);
	const parent = selection[level - 2];
	return parent && map.has(parent) ? taxChildren(parent, map) : [];
}

/**
 * Abhaengige Dropdowns: setzt Ebene `level` auf `value` und leert alle tieferen Ebenen.
 * @returns {string[]} neue Auswahl (Kopie)
 */
function taxCascade(selection, level, value) {
	const next = Array.from({ length: TAX_MAX_DEPTH }, (_, i) => selection[i] || '');
	next[level - 1] = value || '';
	for (let i = level; i < TAX_MAX_DEPTH; i++) next[i] = '';
	return next;
}

/**
 * Uebersetzt die Dropdown-Auswahl in eine Kategorie-id.
 * Alle Ebenen bilden EINEN Pfad: lueckenlos, jede Ebene ein Kind der vorherigen.
 * @returns {{ id: string|null, error: string|null }}  alles leer → { id: null, error: null }
 */
function taxSelectionToId(selection, nodes) {
	const map = nodes || taxGetNodes();
	const sel = Array.from({ length: TAX_MAX_DEPTH }, (_, i) => String(selection[i] || ''));
	let last = -1;
	sel.forEach((v, i) => { if (v) last = i; });
	if (last < 0) return { id: null, error: null };
	let prev = null;
	for (let i = 0; i <= last; i++) {
		const id = sel[i];
		if (!id) return { id: null, error: `Kategorie_${i + 1} ist leer, aber eine tiefere Ebene ist gewählt.` };
		const node = map.get(id);
		if (!node) return { id: null, error: `Kategorie_${i + 1}: „${id}“ existiert nicht.` };
		if ((node.parent || null) !== prev) return { id: null, error: `Kategorie_${i + 1}: „${node.name}“ gehört nicht zur Auswahl darüber.` };
		prev = id;
	}
	return { id: sel[last], error: null };
}

/**
 * Loest Anzeigenamen (oder ids) je Ebene zu einem Pfad auf, z. B. ['Material', 'Edelstein'].
 * @returns {{ id: string|null, error: string|null }}  alles leer → { id: null, error: null }
 */
function taxResolveColumns(names, nodes) {
	const map = nodes || taxGetNodes();
	const cells = Array.from({ length: TAX_MAX_DEPTH }, (_, i) => String(names[i] == null ? '' : names[i]).trim());
	let last = -1;
	cells.forEach((v, i) => { if (v) last = i; });
	if (last < 0) return { id: null, error: null };
	const chosen = [];
	let parent = null;
	for (let i = 0; i <= last; i++) {
		const cell = cells[i];
		if (!cell) return { id: null, error: `Kategorie_${i + 1} ist leer, aber Kategorie_${last + 1} gefüllt.` };
		const low = cell.toLowerCase();
		const hit = taxChildren(parent, map).find(n => n.id.toLowerCase() === low || n.name.toLowerCase() === low);
		if (!hit) {
			const where = parent ? `unter „${map.get(parent).name}“` : 'auf oberster Ebene';
			return { id: null, error: `Kategorie_${i + 1} „${cell}“ gibt es ${where} nicht.` };
		}
		chosen.push(hit.id);
		parent = hit.id;
	}
	return { id: parent, error: null };
}

// ── Migration älterer Taxonomien ─────────────────────────────

/**
 * Migriert eine serialisierte Taxonomie (Export-Form) auf den aktuellen Stand:
 *  - „Göttliches > Domäne & Aspekt“ wird nach „Konzept > Domäne & Aspekt“ verschoben
 *    (Name, eigene Unterkategorien bleiben erhalten),
 *  - „Göttliches“ und „Beiname & Archetyp“ werden aufgelöst; eigene Unterkategorien
 *    daruntern stehen danach auf oberster Ebene (nichts wird gelöscht),
 *  - bei addNewDefaults werden die neuen Standardknoten ergänzt.
 * Idempotent; verändert das Eingabeobjekt nicht.
 * @returns {{ obj: Object, notes: string[], changed: boolean }}
 */
function taxMigrateSerialized(input, opts) {
	const addNewDefaults = !!(opts && opts.addNewDefaults);
	const notes = [];
	let changed = false;
	if (!input || typeof input !== 'object' || !input.knoten || typeof input.knoten !== 'object') {
		return { obj: input, notes, changed };
	}
	const knoten = {};
	for (const [id, v] of Object.entries(input.knoten)) knoten[id] = (v && typeof v === 'object') ? { ...v } : v;
	const M = TAXONOMY_MIGRATION;
	const nameOf = id => (knoten[id] && knoten[id].name) || id;
	const reparent = (fromId, toId) => {
		Object.values(knoten).forEach(n => { if (n && typeof n === 'object' && n.parent === fromId) n.parent = toId; });
	};

	// 1) verschobene Knoten
	for (const [oldId, newId] of Object.entries(M.LEGACY_IDS)) {
		if (!knoten[oldId]) continue;
		const old = knoten[oldId];
		if (!knoten[newId]) {
			const parentId = newId.includes('.') ? newId.slice(0, newId.lastIndexOf('.')) : null;
			knoten[newId] = { name: old.name, parent: (parentId && knoten[parentId]) ? parentId : null };
			if (old.blockiereTeilbaum) knoten[newId].blockiereTeilbaum = true;
		}
		reparent(oldId, newId);
		delete knoten[oldId];
		changed = true;
		notes.push(`Kategorie „${old.name}“ wurde von „Göttliches“ nach „${nameOf(knoten[newId].parent || newId)}“ verschoben (Zuordnungen bleiben erhalten).`);
	}

	// 2) aufgelöste Knoten
	for (const id of Object.keys(M.REMOVED)) {
		if (!knoten[id]) continue;
		const orphans = Object.entries(knoten).filter(([, n]) => n && n.parent === id).map(([oid]) => oid);
		reparent(id, null);
		delete knoten[id];
		changed = true;
		notes.push(`Kategorie „${M.REMOVED[id]}“ wurde aufgelöst. Einträge mit dieser Zuordnung behalten sie als unbekannte Referenz bzw. verlieren sie beim Import mit Warnung – bitte neu zuordnen (z. B. zu „Namensgebung“).` +
			(orphans.length ? ` Eigene Unterkategorien (${orphans.map(nameOf).join(', ')}) stehen jetzt auf oberster Ebene.` : ''));
	}

	// 3) neue Standardknoten (nur beim Heraufstufen aelterer Staende)
	if (addNewDefaults) {
		for (const id of M.V2_NEW_IDS) {
			if (knoten[id]) continue;
			const def = TAXONOMY_DEFAULT_NODES.find(n => n[0] === id);
			if (!def) continue;
			const parent = def[2] && knoten[def[2]] ? def[2] : null;
			if (def[2] && !parent) continue;      // Oberkategorie fehlt (vom Nutzer entfernt): nicht erzwingen
			knoten[id] = { name: def[1], parent };
			changed = true;
		}
	}
	return { obj: { ...input, version: TAX_VERSION, knoten }, notes, changed };
}

/** Hinweis auf aufgelöste Kategorien (Anzeigename) oder null. */
function taxRemovedHint(ref) {
	const s = String(ref == null ? '' : ref).trim();
	if (!s) return null;
	const M = TAXONOMY_MIGRATION;
	const low = s.toLowerCase();
	if (M.REMOVED[low]) return M.REMOVED[low];
	const norm = low.split('>').map(p => p.trim()).join('>');
	return M.REMOVED_LABELS.includes(norm) ? s : null;
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
	if (parentId && taxDepth(parentId, nodes) >= TAX_MAX_DEPTH) {
		throw new Error(`Maximal ${TAX_MAX_DEPTH} Ebenen: unter „${nodes.get(parentId).name}“ (Ebene ${taxDepth(parentId, nodes)}) kann keine Unterkategorie angelegt werden.`);
	}
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
	const mig = taxMigrateSerialized(obj, { addNewDefaults: false });
	if (warnings) mig.notes.forEach(n => warnings.push('Taxonomie aus Datei: ' + n));
	const incoming = taxDeserialize(mig.obj, warnings);
	const nodes = taxGetNodes();
	let added = 0;
	for (const { node } of taxFlatten(incoming)) {
		if (!nodes.has(node.id)) {
			if (node.parent && !nodes.has(node.parent)) continue;
			nodes.set(node.id, { ...node });
			added++;
		}
	}
	if (warnings) taxDepthNotes(incoming).forEach(n => warnings.push('Taxonomie aus Datei: ' + n));
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
	// Alte (verschobene) Kategorien: id oder Pfad aus Version 1 → neue id
	const M = (typeof TAXONOMY_MIGRATION !== 'undefined') ? TAXONOMY_MIGRATION : null;
	if (M) {
		const legacy = M.LEGACY_IDS[low] || M.LEGACY_LABELS[low.split('>').map(p => p.trim()).join('>')];
		if (legacy && map.has(legacy)) return legacy;
	}
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
		if (!primaer) {
			const gone = taxRemovedHint(sem.primaer);
			taxWarn(gone
				? `${label}Kategorie „${gone}“ wurde aufgelöst – ohne Hauptkategorie übernommen, bitte neu zuordnen.`
				: `${label}Kategorie „${sem.primaer}“ unbekannt – ohne Kategorie übernommen.`);
		}
	}
	const weitere = [];
	const list = Array.isArray(sem.weitere) ? sem.weitere : [];
	for (const w of list) {
		if (w == null || String(w).trim() === '') continue;
		const id = taxResolveRef(w, map);
		if (!id) {
			const gone = taxRemovedHint(w);
			taxWarn(gone ? `${label}weitere Kategorie „${gone}“ wurde aufgelöst – ignoriert, bitte neu zuordnen.`
			             : `${label}weitere Kategorie „${w}“ unbekannt – ignoriert.`);
			continue;
		}
		if (id !== primaer && !weitere.includes(id)) weitere.push(id);
	}
	if (!primaer && weitere.length === 0) return null;
	return { primaer, weitere };
}

/** Wert einer Zeilenspalte, Spaltenname ohne Beachtung von Gross-/Kleinschreibung. */
function _taxRowGet(row, name) {
	if (!row) return undefined;
	if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
	const low = name.toLowerCase();
	for (const k of Object.keys(row)) if (k.trim().toLowerCase() === low) return row[k];
	return undefined;
}

/**
 * Liest die Kategorie aus einer flachen Importzeile.
 * Unterstuetzt:
 *  - row.semantik (Objekt, JSON-Import)
 *  - Kurzform: row.kategorie (Pfad „A > B“, id oder eindeutiger Name) + row.kategorie_weitere (kommagetrennt)
 *  - Pfadspalten: Kategorie_1 … Kategorie_5 (je Ebene ein Name; Zeilen mit Luecken sind ungueltig)
 * Widersprechen sich Kurzform und Pfadspalten, wird KEINE Hauptkategorie gesetzt und
 * gewarnt (nichts wird stillschweigend ueberschrieben).
 */
function taxSemantikFromRow(row, key) {
	if (!row) return null;
	const label = key ? `„${key}“: ` : '';
	if (row.semantik && typeof row.semantik === 'object') {
		return taxNormalizeSemantik(row.semantik, key);
	}
	const p = _taxRowGet(row, 'kategorie');
	const pText = p != null ? String(p).trim() : '';
	const w = _taxRowGet(row, 'kategorie_weitere');
	const wText = w != null ? String(w).trim() : '';

	const cols = [1, 2, 3, 4, 5].map(i => {
		const v = _taxRowGet(row, 'Kategorie_' + i);
		return v != null ? String(v).trim() : '';
	});
	const hasCols = cols.some(Boolean);
	if (!pText && !wText && !hasCols) return null;

	let primaerRef = pText;
	if (hasCols) {
		const res = taxResolveColumns(cols);
		if (res.error) {
			taxWarn(`${label}${res.error} – ohne Hauptkategorie übernommen.`);
			primaerRef = '';
		} else {
			if (pText) {
				const shorthand = taxResolveRef(pText);
				if (shorthand !== res.id) {
					taxWarn(`${label}widersprüchliche Angaben: „kategorie“ = „${pText}“, Kategorie_1–5 = „${taxLabel(res.id)}“ – keine Hauptkategorie gesetzt, bitte korrigieren.`);
					return wText ? taxNormalizeSemantik({ primaer: '', weitere: wText.split(',') }, key) : null;
				}
			}
			primaerRef = res.id;
		}
	}
	return taxNormalizeSemantik({ primaer: primaerRef, weitere: wText ? wText.split(',') : [] }, key);
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
