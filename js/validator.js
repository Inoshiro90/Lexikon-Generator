/**
 * validator.js
 * ──────────────────────────────────────────────────────────────────
 * Validates a merged lexikon entries array.
 * No DOM access.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

const _VALID_WORTARTEN = new Set([
  'nomen', 'verb', 'adjektiv', 'präposition', 'praepositon', 'adverb', 'partikel',
]);

/**
 * Validate a list of { key, entry } objects.
 * @param {{ key: string, entry: Object }[]} entries
 * @returns {{ type: 'err'|'warn', msg: string }[]}
 */
function validateLexikon(entries) {
  const issues = [];
  const seen   = new Set();

  entries.forEach(({ key, entry }) => {

    if (seen.has(key)) {
      issues.push({ type: 'err', msg: `"${key}": doppelter Schlüssel` });
    }
    seen.add(key);

    if (!entry.stamm) {
      issues.push({ type: 'err', msg: `"${key}": Stamm fehlt` });
    }

    const wKey = str(entry.wortart).toLowerCase();
    if (!wKey || wKey === '(unbekannt)') {
      issues.push({ type: 'err', msg: `"${key}": Wortart fehlt` });
    } else if (!_VALID_WORTARTEN.has(wKey)) {
      issues.push({ type: 'warn', msg: `"${key}": unbekannte Wortart "${entry.wortart}"` });
    }

    if (!entry.position?.erst && !entry.position?.zweit) {
      issues.push({ type: 'warn', msg: `"${key}": weder erst noch zweit gesetzt` });
    }
  });

  return issues;
}


/* ================================================================
   ENTRY-LEVEL VALIDATION                          // hinzugefügt
   Prüft einen einzelnen Eintrag auf Vollständigkeit
   und gibt { valid, errors } zurück.
   ================================================================ */

/**
 * Validate a single entry against wortart-specific field rules.
 * Called per entry during import.
 * // hinzugefügt
 *
 * @param {string} key
 * @param {Object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEntry(key, entry) {
  const errors  = [];
  const wortart = str(entry?.wortart ?? '');

  if (!wortart) {
    errors.push('Wortart fehlt');
    return { valid: false, errors };
  }

  if (!entry.stamm) {
    errors.push('Feld "stamm" fehlt');
  }

  switch (wortart) {
    case 'Nomen':
      if (!entry.formen?.nom_sg) errors.push('Feld "formen.nom_sg" fehlt');
      if (!entry.formen?.gen_sg) errors.push('Feld "formen.gen_sg" fehlt');
      if (!entry.formen?.plural) errors.push('Feld "formen.plural" fehlt');
      break;
    case 'Verb':
      if (!entry.formen?.infinitiv) errors.push('Feld "formen.infinitiv" fehlt');
      break;
    case 'Adjektiv':
      if (!entry.formen?.positiv) errors.push('Feld "formen.positiv" fehlt');
      break;
    case 'Präposition':
    case 'Adverb':
    case 'Partikel':
      if (!entry.formen?.grundform) errors.push('Feld "formen.grundform" fehlt');
      break;
    // Unbekannte Wortart: nur stamm-Check (bereits oben)
  }

  return { valid: errors.length === 0, errors };
}
