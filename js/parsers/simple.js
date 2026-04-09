/** parsers/simple.js — Präposition, Adverb, Partikel */
'use strict';

function parseSimpleRows(rows) { return rows.map(_simpleRow).filter(Boolean); }

function _simpleRow(row) {
  const key = str(row['key'] || row['lemma'] || row['Key']);
  if (!key) return null;

  const wortart  = str(row['wortart']);
  const istErst  = parseBool(row['erst']  ?? true);
  const istZweit = parseBool(row['zweit'] ?? false);
  const stamm    = str(row['stamm']);
  const grundform = str(row['grundform'] || row['stamm']);

  return {
    key,
    entry: {
      wortart,
      position: { erst: istErst, zweit: istZweit },
      stamm,
      formen: { grundform },
      fuge: {
        als_erst:  resolveFuge(row['fuge_erst'] ?? '', istErst),
        als_zweit: resolveFuge(row['fuge_zweit'],      istZweit),
      },
    },
  };
}

function getPraepositionTemplate() {
  return ['key,wortart,erst,zweit,stamm,grundform,fuge_erst,fuge_zweit',
    'über,Präposition,true,false,über,über,"",','unter,Präposition,true,false,unter,unter,"",',
    'vor,Präposition,true,false,vor,vor,"",'].join('\n');
}

function getAdverbTemplate() {
  return ['key,wortart,erst,zweit,stamm,grundform,fuge_erst,fuge_zweit',
    'immer,Adverb,true,false,immer,immer,"",','hoch,Adverb,true,false,hoch,hoch,"",'].join('\n');
}

function getPartikelTemplate() {
  return ['key,wortart,erst,zweit,stamm,grundform,fuge_erst,fuge_zweit',
    'ur,Partikel,true,false,ur,ur,"",','erz,Partikel,true,false,erz,erz,"",'].join('\n');
}
