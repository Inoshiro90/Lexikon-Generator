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
