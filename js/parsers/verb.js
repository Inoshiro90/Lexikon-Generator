/** parsers/verb.js */
'use strict';

function parseVerbRows(rows) { return rows.map(_verbRow).filter(Boolean); }

function _verbRow(row) {
  const key = str(row['key'] || row['lemma'] || row['Key']);
  if (!key) return null;

  const istErst  = parseBool(row['erst']  ?? true);
  const istZweit = parseBool(row['zweit'] ?? false);
  const stamm    = str(row['stamm']);
  const raw      = row['fuge_erst'];
  const fugeRaw  = (raw !== undefined && raw !== '') ? raw : ',e';

  const entry = {
    wortart: 'Verb',
    position: { erst: istErst, zweit: istZweit },
    stamm,
    formen: { infinitiv: str(row['infinitiv']), stamm },
    fuge: {
      als_erst:  resolveFuge(fugeRaw, istErst),
      als_zweit: resolveFuge(row['fuge_zweit'], istZweit),
    },
  };
  taxApplyToEntry(entry, row, key);
  return { key, entry };
}

function getVerbTemplate() {
  return [
    'key,wortart,erst,zweit,stamm,infinitiv,fuge_erst,fuge_zweit,kategorie,kategorie_weitere',
    'laufen,Verb,true,false,lauf,laufen,",e",,Handlung,',
    'brennen,Verb,true,false,brenn,brennen,",e",,Handlung,',
    'singen,Verb,true,false,sing,singen,",e",,Handlung,',
  ].join('\n');
}
