/**
 * ods-template.js
 * ──────────────────────────────────────────────────────────────────
 * Generates .ods (OpenDocument Spreadsheet) template files
 * for each Wortart via SheetJS.
 *
 * Each template contains:
 *   Row 1: Column headers (field names matching JSON schema)
 *   Row 2: Example entry (pre-filled, editable)
 *
 * Uses triggerBinaryDownload from utils.js.
 * Requires SheetJS (XLSX global) loaded before this file.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * @typedef {Object} OdsTemplateConfig
 * @property {string}     filename   — output filename, e.g. 'vorlage-nomen.ods'
 * @property {string}     sheetName  — worksheet tab name
 * @property {string[][]} data       — array-of-arrays: [headers, example1, example2, …]
 * @property {string[]}   notes      — column notes shown in a second sheet
 */

/** @type {OdsTemplateConfig[]} */
const ODS_TEMPLATES = [
  {
    filename:  'vorlage-nomen.ods',
    sheetName: 'Nomen',
    data: [
      ['key', 'wortart', 'genus', 'erst', 'zweit', 'stamm', 'nom_sg', 'gen_sg', 'plural', 'fuge_erst', 'fuge_zweit'],
      ['Wolf',  'Nomen', 'maskulin', 'true', 'true', 'wolf',  'Wolf',  'Wolfs',  'Wölfe',  ',s', ''],
      ['Stein', 'Nomen', 'maskulin', 'true', 'true', 'stein', 'Stein', 'Steins', 'Steine', '',   ''],
      ['Frau',  'Nomen', 'feminin',  'true', 'true', 'frau',  'Frau',  'Frau',   'Frauen', ',en',''],
      ['Kind',  'Nomen', 'neutrum',  'true', 'true', 'kind',  'Kind',  'Kindes', 'Kinder', ',er',''],
    ],
    notes: [
      'key      = Eindeutiger Schlüssel im Lexikon (z.B. "Wolf")',
      'wortart  = Immer "Nomen"',
      'genus    = maskulin | feminin | neutrum',
      'erst     = true/false — als Erstglied verwendbar',
      'zweit    = true/false — als Zweitglied verwendbar',
      'stamm    = Kleingeschriebener Kompositionsstamm (z.B. "wolf")',
      'nom_sg   = Nominativ Singular (z.B. "Wolf")',
      'gen_sg   = Genitiv Singular (z.B. "Wolfs")',
      'plural   = Plural (z.B. "Wölfe")',
      'fuge_erst  = Fugenlaute als Erstglied, Komma-separiert. Leer = keine Fuge. ",s" = keine + s-Fuge.',
      'fuge_zweit = Fugenlaute als Zweitglied. Leer = keine Fuge. Leer lassen wenn zweit=false.',
    ],
  },
  {
    filename:  'vorlage-verben.ods',
    sheetName: 'Verben',
    data: [
      ['key', 'wortart', 'erst', 'zweit', 'stamm', 'infinitiv', 'fuge_erst', 'fuge_zweit'],
      ['laufen',  'Verb', 'true', 'false', 'lauf',  'laufen',  ',e', ''],
      ['brennen', 'Verb', 'true', 'false', 'brenn', 'brennen', ',e', ''],
      ['singen',  'Verb', 'true', 'false', 'sing',  'singen',  ',e', ''],
    ],
    notes: [
      'key        = Infinitiv oder eindeutiger Name',
      'wortart    = Immer "Verb"',
      'erst       = true/false',
      'zweit      = fast immer false für Verben',
      'stamm      = Verbstamm ohne Endung (z.B. "lauf")',
      'infinitiv  = Grundform (z.B. "laufen")',
      'fuge_erst  = ",e" für Lauf-e-wind. ",e" = keine + e-Fuge.',
      'fuge_zweit = Leer lassen (zweit i.d.R. false)',
    ],
  },
  {
    filename:  'vorlage-adjektive.ods',
    sheetName: 'Adjektive',
    data: [
      ['key', 'wortart', 'erst', 'zweit', 'stamm', 'positiv', 'komparativ', 'superlativ', 'fuge_erst', 'fuge_zweit'],
      ['dunkel',  'Adjektiv', 'true', 'false', 'dunkel',  'dunkel',  'dunkler',  'dunkelst',  ',e', ''],
      ['groß',    'Adjektiv', 'true', 'false', 'groß',    'groß',    'größer',   'größt',     '',   ''],
      ['schnell', 'Adjektiv', 'true', 'false', 'schnell', 'schnell', 'schneller','schnellst', ',e', ''],
    ],
    notes: [
      'key        = Adjektiv in Grundform',
      'wortart    = Immer "Adjektiv"',
      'positiv    = Grundstufe (z.B. "dunkel")',
      'komparativ = Steigerung (z.B. "dunkler")',
      'superlativ = Höchststufe (z.B. "dunkelst")',
      'fuge_erst  = ",e" für dunkle-Wald. Leer = Dunkel-wald.',
    ],
  },
  {
    filename:  'vorlage-praepositionen.ods',
    sheetName: 'Präpositionen',
    data: [
      ['key', 'wortart', 'erst', 'zweit', 'stamm', 'grundform', 'fuge_erst', 'fuge_zweit'],
      ['über',  'Präposition', 'true', 'false', 'über',  'über',  '', ''],
      ['unter', 'Präposition', 'true', 'false', 'unter', 'unter', '', ''],
      ['vor',   'Präposition', 'true', 'false', 'vor',   'vor',   '', ''],
    ],
    notes: [
      'grundform = Unveränderliche Form der Präposition',
      'fuge_erst = Meist leer (keine Fuge bei Präpositionen)',
    ],
  },
  {
    filename:  'vorlage-adverbien.ods',
    sheetName: 'Adverbien',
    data: [
      ['key', 'wortart', 'erst', 'zweit', 'stamm', 'grundform', 'fuge_erst', 'fuge_zweit'],
      ['immer', 'Adverb', 'true', 'false', 'immer', 'immer', '', ''],
      ['hoch',  'Adverb', 'true', 'false', 'hoch',  'hoch',  '', ''],
    ],
    notes: ['grundform = Unveränderliche Adverbform'],
  },
  {
    filename:  'vorlage-partikel.ods',
    sheetName: 'Partikel',
    data: [
      ['key', 'wortart', 'erst', 'zweit', 'stamm', 'grundform', 'fuge_erst', 'fuge_zweit'],
      ['ur',  'Partikel', 'true', 'false', 'ur',  'ur',  '', ''],
      ['erz', 'Partikel', 'true', 'false', 'erz', 'erz', '', ''],
    ],
    notes: ['Verstärkungspartikel als Präfix: Ur-wald, Erz-berg'],
  },
];

/**
 * Generate and download an ODS template for a given wortart.
 *
 * @param {string} wortartKey  — e.g. 'Nomen', 'Verb', 'Adjektiv', …
 */
function downloadODSTemplate(wortartKey) {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS (XLSX) ist nicht geladen. ODS-Export nicht verfügbar.');
    return;
  }

  const config = ODS_TEMPLATES.find(
    t => t.sheetName.toLowerCase() === wortartKey.toLowerCase() ||
         t.sheetName.toLowerCase().replace(/en$/, '') === wortartKey.toLowerCase().replace(/en$/, '')
  );

  if (!config) {
    alert(`Keine ODS-Vorlage für Wortart "${wortartKey}" gefunden.`);
    return;
  }

  const wb = XLSX.utils.book_new();

  // ── Data sheet ────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(config.data);

  // Style the header row (bold — SheetJS Community supports limited styling)
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellAddr]) {
      ws[cellAddr].s = {
        font:   { bold: true },
        fill:   { fgColor: { rgb: 'F6F5F4' } },
        border: {
          bottom: { style: 'thin', color: { rgb: 'A39E98' } },
        },
      };
    }
  }

  // Set column widths
  ws['!cols'] = config.data[0].map(header => ({
    wch: Math.max(header.length + 2, 14),
  }));

  XLSX.utils.book_append_sheet(wb, ws, config.sheetName);

  // ── Notes / Legende sheet ──────────────────────────────────────
  const notesData = [
    ['Spalte', 'Erklärung'],
    ...config.notes.map(n => {
      const [col, ...rest] = n.split('=');
      return [col.trim(), rest.join('=').trim()];
    }),
    [],
    ['Fuge-Format', 'Komma-separierte Werte innerhalb der Zelle'],
    ['Beispiel',    '",s" → ["", "s"]  (keine Fuge + s-Fuge)'],
    ['',            '"" oder leer → [""]  (keine Fuge)'],
    ['',            '"e,s" → ["e", "s"]  (e-Fuge + s-Fuge)'],
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes['!cols'] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Legende');

  // ── Write + download ───────────────────────────────────────────
  try {
    const out = XLSX.write(wb, { bookType: 'ods', type: 'array' });
    triggerBinaryDownload(
      out,
      config.filename,
      'application/vnd.oasis.opendocument.spreadsheet'
    );
  } catch (e) {
    // ODS write failed (older SheetJS) — fall back to XLSX
    console.warn('[ODS] ODS write failed, falling back to XLSX:', e);
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerBinaryDownload(
      out,
      config.filename.replace('.ods', '.xlsx'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    showToast('ODS nicht verfügbar — XLSX heruntergeladen');
  }
}
