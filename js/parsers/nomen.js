/**
 * parsers/nomen.js
 * Rows → LexikonEntry for Nomen.
 * Fuge format: comma-separated cell value → array
 *   ",s" → ["", "s"] | "" → [""] | "en" → ["en"]
 */
'use strict';

const NOMEN_VALID_GENUS = new Set(['maskulin', 'feminin', 'neutrum']);

function parseNomenRows(rows) { return rows.map(_nomenRow).filter(Boolean); }

function _nomenRow(row) {
  const key = str(row['key'] || row['lemma'] || row['Key'] || row['Lemma']);
  if (!key) return null;

  const istErst  = parseBool(row['erst']  ?? true);
  const istZweit = parseBool(row['zweit'] ?? true);
  const genusRaw = str(row['genus']).toLowerCase();
  const genus    = NOMEN_VALID_GENUS.has(genusRaw) ? genusRaw : undefined;
  const stamm    = str(row['stamm']);

  const entry = {
    wortart: 'Nomen',
    position: { erst: istErst, zweit: istZweit },
    stamm,
    formen: {
      nom_sg: str(row['nom_sg']),
      gen_sg: str(row['gen_sg']),
      plural: str(row['plural']),
    },
    fuge: {
      als_erst:  resolveFuge(row['fuge_erst'],  istErst),
      als_zweit: resolveFuge(row['fuge_zweit'], istZweit),
    },
  };

  if (genus) {
    const { wortart, position, stamm: s, formen, fuge } = entry;
    return { key, entry: { wortart, genus, position, stamm: s, formen, fuge } };
  }
  return { key, entry };
}

function getNomenTemplate() {
  return [
    'key,wortart,genus,erst,zweit,stamm,nom_sg,gen_sg,plural,fuge_erst,fuge_zweit',
    'Wolf,Nomen,maskulin,true,true,wolf,Wolf,Wolfs,Wölfe,",s",""',
    'Stein,Nomen,maskulin,true,true,stein,Stein,Steins,Steine,"",""',
    'Frau,Nomen,feminin,true,true,frau,Frau,Frau,Frauen,",en",""',
    'Kind,Nomen,neutrum,true,true,kind,Kind,Kindes,Kinder,",er",""',
  ].join('\n');
}
