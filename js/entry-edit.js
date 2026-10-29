/**
 * entry-edit.js
 * Reine Hilfsfunktionen zum Bearbeiten eines Lexikoneintrags in der Vorschautabelle
 * (kein DOM, unter Node testbar).
 *
 * Grundsaetze
 *  - Es wird immer mit einem Deep-Clone des vollstaendigen Eintrags gearbeitet;
 *    nicht bearbeitete Felder, `semantik` und unbekannte Zusatzfelder bleiben erhalten.
 *  - Nur tatsaechlich GEAENDERTE Felder werden geschrieben (kein unbeabsichtigtes
 *    Anlegen von `semantik`, `formen`, `genus` …).
 *  - Fehlende verschachtelte Objekte (`formen`, `position`, `fuge`) werden vor dem
 *    Schreiben sicher angelegt.
 *  - Vor dem Speichern wird validiert (validateEntry + Feldregeln).
 *
 * Abhaengigkeiten: validator.js (validateEntry), taxonomy.js (taxSelectionToId)
 */

'use strict';

/** Darstellung von „keine Fuge“ (leerer String) in Fugenzellen. */
const ENTRY_FUGE_EMPTY = '∅';

const ENTRY_VALID_GENUS = ['maskulin', 'feminin', 'neutrum'];

/** Liefert entry[key] als Objekt; legt es an, wenn es fehlt oder kein Objekt ist. */
function entryEnsure(entry, key) {
  if (!entry[key] || typeof entry[key] !== 'object' || Array.isArray(entry[key])) entry[key] = {};
  return entry[key];
}

/** Fugen-Array → Zellentext. [''] → „∅“, ['', 's'] → „∅,s“, null → „“. */
function fugeToText(list) {
  if (!Array.isArray(list)) return '';
  return list.map(f => (f === '' ? ENTRY_FUGE_EMPTY : String(f))).join(',');
}

/**
 * Zellentext → Fugen-Array (wie beim Import: leer = keine Fuge, „,s“ = keine + s).
 * canUse=false (Position nicht erlaubt) → null.
 */
function fugeFromText(text, canUse) {
  if (!canUse) return null;
  const s = String(text == null ? '' : text).trim();
  if (s === '') return [''];
  return s.split(',').map(p => p.trim()).map(p => (p === ENTRY_FUGE_EMPTY ? '' : p));
}

/**
 * Setzt Haupt- und/oder weitere Kategorien und raeumt auf
 * (leere Zuordnung → `semantik` wird entfernt). undefined = unveraendert.
 */
function entrySetSemantik(entry, primaer, weitere) {
  const cur = entry.semantik && typeof entry.semantik === 'object' ? entry.semantik : { primaer: null, weitere: [] };
  if (primaer !== undefined) cur.primaer = primaer || null;
  if (weitere !== undefined) cur.weitere = weitere;
  cur.weitere = (Array.isArray(cur.weitere) ? cur.weitere : [])
    .filter((id, i, a) => id && id !== cur.primaer && a.indexOf(id) === i);
  if (!cur.primaer && cur.weitere.length === 0) delete entry.semantik;
  else entry.semantik = cur;
}

/** Eingabewert einer Spalte (String bzw. Liste) fuer den Vergleich „geaendert?“. */
function _entryColInput(col, key, entry) {
  if (typeof col.value === 'function') return col.value(key, entry);
  const v = col.get(key, entry);
  return v == null ? '' : String(v);
}

function _sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || []);
  return String(a) === String(b);
}

/**
 * Wendet Bearbeitungen auf eine KOPIE des Eintrags an und validiert.
 *
 * @param {Object} original   unveraenderter Eintrag
 * @param {Object[]} cols     Spaltendefinitionen (WORTART_PREVIEW_COLS[wortart])
 * @param {Object<string,(string|string[])>} values  Eingabewerte je Spalten-key
 * @param {Object} [opts]
 * @param {string} [opts.key]   Wort (fuer Validierung)
 * @param {string[]|null} [opts.kategorieAuswahl]  Dropdown-Auswahl Kategorie_1–5, NUR wenn der
 *        Nutzer eine Ebene geaendert hat; null = Kategorie nicht anfassen
 * @returns {{ entry: Object, errors: {field:string, msg:string}[], changed: boolean }}
 */
function entryApplyEdits(original, cols, values, opts) {
  const key = (opts && opts.key) || '';
  const entry = JSON.parse(JSON.stringify(original));
  const errors = [];
  const changedKeys = new Set();
  let changed = false;

  cols.forEach(col => {
    if (!col.set || col.type === 'katlevel') return;
    if (!Object.prototype.hasOwnProperty.call(values, col.key)) return;
    const next = values[col.key];
    if (_sameValue(next, _entryColInput(col, key, original))) return;   // unveraendert → nicht anfassen
    col.set(entry, next);
    changedKeys.add(col.key);
    changed = true;
  });

  // Position und Fugen muessen zusammenpassen (wie in den Parsern):
  // Position nicht erlaubt → Fuge null; erlaubt, aber ohne Fuge → [''].
  ['erst', 'zweit'].forEach(side => {
    if (!changedKeys.has(side) && !changedKeys.has('fuge_' + side)) return;
    const pos = entryEnsure(entry, 'position');
    const fuge = entryEnsure(entry, 'fuge');
    const slot = 'als_' + side;
    fuge[slot] = pos[side] ? (Array.isArray(fuge[slot]) && fuge[slot].length ? fuge[slot] : ['']) : null;
  });

  // Kategorie (Pfad Kategorie_1–5) – nur wenn bewusst geaendert
  if (opts && Array.isArray(opts.kategorieAuswahl)) {
    const res = taxSelectionToId(opts.kategorieAuswahl);
    if (res.error) {
      errors.push({ field: 'kategorie', msg: res.error });
    } else if ((entry.semantik && entry.semantik.primaer || null) !== res.id) {
      entrySetSemantik(entry, res.id, undefined);        // weitere bleiben erhalten
      changed = true;
    }
  }

  // Feldregeln
  if (entry.genus !== undefined && entry.genus !== '' && !ENTRY_VALID_GENUS.includes(entry.genus)) {
    errors.push({ field: 'genus', msg: 'Genus muss maskulin, feminin oder neutrum sein.' });
  }
  if (entry.genus === '') delete entry.genus;

  const check = validateEntry(key, entry);
  check.errors.forEach(msg => {
    const m = /"formen\.(\w+)"/.exec(msg);
    const field = m ? m[1] : (/"stamm"/.test(msg) ? 'stamm' : 'eintrag');
    errors.push({ field, msg });
  });

  return { entry, errors, changed };
}
