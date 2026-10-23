/**
 * lexikon-build.js
 * Baut aus der flachen Eintragsliste das Ausgabe-Objekt (nach Wortart gruppiert,
 * Taxonomie als letzter Schlüssel). Reine Funktion, kein DOM.
 */

'use strict';

/** entry.wortart → Gruppenschlüssel im Ausgabe-Objekt */
const LEXIKON_WORTART_TO_KEY = {
  'Nomen':       'nomen',
  'Verb':        'verben',
  'Adjektiv':    'adjektive',
  'Präposition': 'präpositionen',
  'Adverb':      'adverbien',
  'Partikel':    'partikel',
};

/**
 * @param {{ key: string, entry: Object }[]} entries
 * @param {Object} [taxonomie]  serialisierte Taxonomie (taxSerialize()); weglassen = keine einbetten
 * @returns {Object}
 */
function buildLexikonObject(entries, taxonomie) {
  // feste Gruppen in definierter Reihenfolge vorinitialisieren
  const lexikon = {
    nomen:         {},
    verben:        {},
    adjektive:     {},
    präpositionen: {},
    adverbien:     {},
    partikel:      {},
  };

  entries.forEach(({ key, entry }) => {
    const wortart   = entry.wortart ?? '';
    // bekannte Wortart → fester Key; unbekannt → lowercase oder "unbekannt"
    const gruppeKey = LEXIKON_WORTART_TO_KEY[wortart]
      ?? (wortart ? wortart.toLowerCase() : 'unbekannt');
    if (!lexikon[gruppeKey]) lexikon[gruppeKey] = {};
    lexikon[gruppeKey][key] = entry;
  });

  // Metadaten immer ALS LETZTEN Schlüssel: der Namensgenerator erkennt das
  // Lexikonformat an der Gruppenstruktur; nichts darf davor eingeschoben werden.
  if (taxonomie) lexikon._taxonomie = taxonomie;
  return lexikon;
}
