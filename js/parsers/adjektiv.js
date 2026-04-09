/** parsers/adjektiv.js */
'use strict';

function parseAdjektivRows(rows) { return rows.map(_adjektivRow).filter(Boolean); }

function _adjektivRow(row) {
  const key = str(row['key'] || row['lemma'] || row['Key']);
  if (!key) return null;

  const istErst  = parseBool(row['erst']  ?? true);
  const istZweit = parseBool(row['zweit'] ?? false);
  const raw      = row['fuge_erst'];
  const fugeRaw  = (raw !== undefined && raw !== '') ? raw : ',e';

  return {
    key,
    entry: {
      wortart: 'Adjektiv',
      position: { erst: istErst, zweit: istZweit },
      stamm: str(row['stamm']),
      formen: {
        positiv:    str(row['positiv']),
        komparativ: str(row['komparativ']),
        superlativ: str(row['superlativ']),
      },
      fuge: {
        als_erst:  resolveFuge(fugeRaw, istErst),
        als_zweit: resolveFuge(row['fuge_zweit'], istZweit),
      },
    },
  };
}

function getAdjektivTemplate() {
  return [
    'key,wortart,erst,zweit,stamm,positiv,komparativ,superlativ,fuge_erst,fuge_zweit',
    'dunkel,Adjektiv,true,false,dunkel,dunkel,dunkler,dunkelst,",e",',
    'groß,Adjektiv,true,false,groß,groß,größer,größt,"",',
    'schnell,Adjektiv,true,false,schnell,schnell,schneller,schnellst,",e",',
  ].join('\n');
}
