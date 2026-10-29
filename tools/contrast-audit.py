#!/usr/bin/env python3
"""
Kontrast-Audit (Playwright/Chromium) – kein Teil von `npm test`.

  python3 tools/contrast-audit.py [Projektordner]

Liest für sichtbare Textelemente die *berechneten* Farben (Vordergrund inkl. Alpha, Hintergrund durch
Überlagerung der Vorfahren-Hintergründe) und vergleicht mit WCAG 2.2 AA:
  Text 4,5:1 (großer Text ≥ 24 px bzw. ≥ 18,66 px fett: 3:1); deaktivierte Elemente sind ausgenommen.
Zusätzlich (WCAG 1.4.11, 3:1): Rahmen der Eingabefelder und der Fokusring (sichtbarer Tastaturfokus).
Zustände: Start, Daten + Kategorien + Ausgabe, Bearbeitungszeile, geöffneter Dialog, Toast – je hell/dunkel.
Prüft keine Verläufe/Bilder, keine Hover-/Aktivzustände und keine reine Grafik außer Fokus/Feldrand.
Exit-Code 1, wenn Fehler gefunden werden.
"""
import sys, os, json
from playwright.sync_api import sync_playwright

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
ROWS = [
    {"key": "Rubin", "wortart": "Nomen", "genus": "maskulin", "erst": True, "zweit": True, "stamm": "rubin",
     "nom_sg": "Rubin", "gen_sg": "Rubins", "plural": "Rubine", "fuge_erst": ",s", "fuge_zweit": ""},
    {"key": "Wolf", "wortart": "Nomen", "genus": "maskulin", "erst": True, "zweit": True, "stamm": "wolf",
     "nom_sg": "Wolf", "gen_sg": "Wolfs", "plural": "Wölfe", "fuge_erst": ",s", "fuge_zweit": "",
     "semantik": {"primaer": "gibtsnicht.x"}},
]

JS = r"""
() => {
  const __cv = document.createElement('canvas'); __cv.width = __cv.height = 1; const __cx = __cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => { if (!c) return null; __cx.clearRect(0, 0, 1, 1); __cx.fillStyle = '#000'; __cx.fillStyle = c; __cx.globalCompositeOperation = 'copy'; __cx.fillRect(0, 0, 1, 1); const d = __cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { chain.push(c); if (c.a >= 1) break; } }
    let bg = { r: 255, g: 255, b: 255, a: 1 }; const pageBg = parse(getComputedStyle(document.body).backgroundColor); if (pageBg && pageBg.a > 0) bg = pageBg;
    for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg); return bg; };
  const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const fails = [];
  const all = document.querySelectorAll('body *');
  all.forEach((el) => {
    if (el.closest('script,style,svg')) return;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);
    if (!hasText) return;
    if (el.disabled || el.closest('[disabled]') || el.getAttribute('aria-disabled') === 'true') return;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) return;
    const bg = bgOf(el); let fg = parse(cs.color); if (!fg) return;
    const op = opacityOf(el); fg = { ...fg, a: fg.a * op };
    const eff = over(fg, bg);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const r = ratio(eff, bg);
    if (r < need) fails.push({ el: name(el), ratio: Math.round(r * 100) / 100, need, size, text: el.textContent.trim().slice(0, 28) });
  });
  // Eingabefeldrand (1.4.11)
  document.querySelectorAll('input[type=text], textarea, select, .form-input, .cell-input').forEach((el) => {
    if (el.checkVisibility && !el.checkVisibility()) return;
    const cs = getComputedStyle(el); const b = parse(cs.borderTopColor); if (!b || parseFloat(cs.borderTopWidth) < 1) { fails.push({ el: name(el), ratio: 0, need: 3, text: 'kein Rand' }); return; }
    const parentBg = bgOf(el.parentElement); const r = ratio(over(b, parentBg), parentBg);
    if (r < 3) fails.push({ el: name(el) + ' [Rand]', ratio: Math.round(r * 100) / 100, need: 3, text: '' });
  });
  return fails;
}
"""

FOCUS_JS = r"""
(sel) => {
  const el = document.querySelector(sel); if (!el) return null; el.focus();
  const cs = getComputedStyle(el);
  const __cv = document.createElement('canvas'); __cv.width = __cv.height = 1; const __cx = __cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => { if (!c) return null; __cx.clearRect(0, 0, 1, 1); __cx.fillStyle = '#000'; __cx.fillStyle = c; __cx.globalCompositeOperation = 'copy'; __cx.fillRect(0, 0, 1, 1); const d = __cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const o = parse(cs.outlineColor);
  const bgs = [];
  for (let e = el.parentElement; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a >= 1) { bgs.push(c); break; } }
  const bg = bgs[0] || parse(getComputedStyle(document.body).backgroundColor);
  const x = lum(o), y = lum(bg);
  return { outline: cs.outlineStyle + ' ' + cs.outlineWidth, ratio: Math.round((Math.max(x, y) + .05) / (Math.min(x, y) + .05) * 100) / 100 };
}
"""

def main():
    total = 0
    report = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for theme in ('light', 'dark'):
            ctx = b.new_context(viewport={'width': 1280, 'height': 900})
            ctx.add_init_script(f"try{{localStorage.setItem('ds-warm-theme','{theme}')}}catch(e){{}}")
            p = ctx.new_page(); p.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
            p.goto('file://' + root + '/index.html'); p.wait_for_timeout(250)
            states = {}
            states['start'] = p.evaluate(JS)
            p.evaluate("""(rows) => { document.querySelector('#taxonomyPanel details').open = true; _panels.get('Nomen').importRows(rows, 'json'); }""", ROWS)
            p.wait_for_timeout(250)
            p.click('#generateBtn'); p.wait_for_timeout(300)
            states['daten+ausgabe+validierung'] = p.evaluate(JS)
            p.click('tr[data-key="Rubin"] [data-action="edit"]'); p.wait_for_timeout(100)
            states['bearbeiten'] = p.evaluate(JS)
            p.evaluate("document.querySelector('tr.row-editing [data-action=cancel]').click()")
            p.evaluate("showToast('Statusmeldung zum Testen des Kontrasts')"); p.wait_for_timeout(300)
            states['toast'] = p.evaluate(JS)
            p.evaluate("document.querySelector('.tax-row[data-id=material] [data-tax-action=remove]').click()"); p.wait_for_timeout(300)
            states['dialog (danger)'] = p.evaluate(JS)
            p.keyboard.press('Escape'); p.wait_for_timeout(100)
            p.evaluate("document.querySelector('[data-tax-action=add-root]').click()"); p.wait_for_timeout(300)
            p.evaluate("document.querySelector('dialog input').value=''; document.querySelector('dialog [type=submit]').click()"); p.wait_for_timeout(100)
            states['dialog (Eingabe, Fehler)'] = p.evaluate(JS)
            p.keyboard.press('Escape'); p.wait_for_timeout(100)
            focus = {}
            for sel in ['#generateBtn', '#themeToggle', '.tax-row .btn-icon', '.form-select', '#copyBtn', '.mini-tab.active', '.drop-zone input']:
                focus[sel] = p.evaluate(FOCUS_JS, sel)
            report.append((theme, states, focus))
            ctx.close()
        b.close()
    for theme, states, focus in report:
        print(f'===== {theme.upper()} =====')
        for st, fails in states.items():
            total += len(fails)
            print(f'  [{st}] Verstöße: {len(fails)}')
            seen = set()
            for f in fails:
                k = (f['el'], f['ratio'])
                if k in seen: continue
                seen.add(k)
                print(f"      {f['el']:<44s} {f['ratio']}:1 (nötig {f['need']}) „{f['text']}“")
        print('  Fokusring (Kontrast gegen Hintergrund, nötig ≥ 3:1):')
        for sel, v in focus.items():
            if v is None: print(f'      {sel:<24s} (Element nicht vorhanden)'); continue
            flag = '' if v['ratio'] >= 3 else '   <-- ZU SCHWACH'
            if v['ratio'] < 3: total += 1
            print(f"      {sel:<24s} {v['outline']:<14s} {v['ratio']}:1{flag}")
    print('\nGesamt Verstöße:', total)
    sys.exit(1 if total else 0)

main()
