#!/usr/bin/env python3
"""
Layout-Prüfung (Playwright/Chromium) der Akkordeon-Kopfzeilen und des Kategorienbaums – kein Teil von `npm test`.
Aufruf: python3 tools/accordion-check.py [Projektordner] [Screenshot-Ordner]
Prüft je Viewport (320/360/390/768/1280) und Theme (hell/dunkel): kein horizontaler Seitenüberlauf, gleiche Schriftgröße
und Kopfzeilenhöhe über alle Ebenen, lange Namen nicht abgeschnitten, Aktionsbuttons überlappen weder Name noch einander,
Trefferflächen, sichtbarer Fokusring. Exit-Code 1 bei Fehlern.
"""
import sys, os
from playwright.sync_api import sync_playwright

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
shots = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else None
if shots: os.makedirs(shots, exist_ok=True)
results = []
def check(name, ok, info=''):
    results.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

LONG = 'Außergewöhnlich-langer-Kategoriename-ohne-Leerzeichen-zum-Umbruchtest und noch mehr Text dahinter'
SETUP = """(long) => {
  document.querySelector('#taxonomyPanel details').open = true;
  document.querySelector('#lexikonLoader details').open = true;
  let id = taxAddNode(null, long);
  for (let i = 2; i <= 5; i++) id = taxAddNode(id, 'Ebene ' + i + ' ' + long);
  taxAddNode('material', 'Kurz');
  document.querySelectorAll('.tax-toggle[aria-expanded="false"]').forEach(b => b.click());
  // zweiter Durchgang: durch Aufklappen neu sichtbar gewordene Toggles
  for (let k = 0; k < 6; k++) document.querySelectorAll('.tax-toggle[aria-expanded="false"]').forEach(b => b.click());
}"""
MEASURE = """() => {
  const de = document.documentElement;
  const rows = [...document.querySelectorAll('.tax-row')].filter(r => r.getClientRects().length);
  const fs = new Set(rows.map(r => getComputedStyle(r.querySelector('.tax-name')).fontSize));
  const hs = rows.map(r => Math.round(r.querySelector('.tax-toggle').getBoundingClientRect().height));
  const overlap = (a, b) => !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
  let bad = 0, clipped = 0, small = 0;
  rows.forEach(r => {
    const t = r.querySelector('.tax-toggle').getBoundingClientRect();
    const btns = [...r.querySelectorAll('.tax-actions button, .tax-actions .tax-flag')].map(b => b.getBoundingClientRect());
    btns.forEach((b, i) => { if (overlap(b, t)) bad++; btns.slice(i + 1).forEach(c => { if (overlap(b, c)) bad++; }); if (b.width < 24 || b.height < 24) small++; });
    const n = r.querySelector('.tax-name'); if (n.scrollWidth > n.clientWidth + 1) clipped++;
    if (r.getBoundingClientRect().right > de.clientWidth + 0.5) bad++;
  });
  const deepest = rows.reduce((m, r) => Math.max(m, r.querySelector('.tax-name').getBoundingClientRect().width), 0);
  const last = rows.filter(r => r.closest('.tax-node').dataset.level === '5').pop();
  return { overflow: de.scrollWidth - de.clientWidth, sizes: [...fs], minH: Math.min(...hs), maxH: Math.max(...hs), bad, clipped, small,
           rows: rows.length, lvl5Name: last ? Math.round(last.querySelector('.tax-name').getBoundingClientRect().width) : 0,
           hintOk: !!document.querySelector('#taxonomyPanel .acc-title') };
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for theme in ('light', 'dark'):
        for w in (320, 360, 390, 768, 1280):
            ctx = b.new_context(viewport={'width': w, 'height': 900}, has_touch=w < 700, is_mobile=w < 700)
            p = ctx.new_page(); errs = []; p.set_default_timeout(4000)
            p.on('pageerror', lambda e: errs.append(str(e)))
            p.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
            p.goto('file://' + root + '/index.html'); p.wait_for_timeout(250)
            p.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
            p.evaluate(SETUP, LONG); p.wait_for_timeout(200)
            m = p.evaluate(MEASURE); tag = f'{theme} {w}px'
            check(f'{tag}: kein horizontaler Seitenüberlauf', m['overflow'] <= 0, f"overflow={m['overflow']}")
            check(f'{tag}: eine Schriftgröße über alle Ebenen', len(m['sizes']) == 1, str(m['sizes']))
            check(f'{tag}: Kopfzeilenhöhe Ebene 1–5 vergleichbar (Name darf umbrechen)', m['minH'] >= 30, f"{m['minH']}–{m['maxH']}px")
            check(f'{tag}: lange Namen nicht abgeschnitten', m['clipped'] == 0, f"clipped={m['clipped']}")
            check(f'{tag}: keine überlappenden Aktionen / Zeilen im Viewport', m['bad'] == 0, f"bad={m['bad']}")
            check(f'{tag}: Trefferflächen ≥ 24 px', m['small'] == 0, f"small={m['small']}")
            check(f'{tag}: Name auf Ebene 5 lesbar breit', m['lvl5Name'] >= (120 if w >= 320 else 0), f"{m['lvl5Name']}px")
            check(f'{tag}: keine JS-Fehler', not errs, '; '.join(errs))
            if w in (320, 1280):
                p.focus('.tax-toggle'); p.keyboard.press('Tab')
                ring = p.evaluate("() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; }")
                check(f'{tag}: Fokusring sichtbar', ring)
            if shots:
                p.locator('#taxonomyPanel').scroll_into_view_if_needed()
                p.locator('#taxonomyPanel').screenshot(path=f'{shots}/{theme}-{w}.png')
            ctx.close()
    b.close()
print(f"\n{sum(results)}/{len(results)} bestanden"); sys.exit(0 if all(results) else 1)
