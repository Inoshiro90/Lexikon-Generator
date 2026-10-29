#!/usr/bin/env python3
"""
Browser-Audit (Playwright/Chromium) für den Lexikon-Generator – kein Teil von `npm test`.

  python3 tools/ui-audit.py [Projektordner] [--shots Ausgabeordner]

Prüft je Viewport (Touch/Maus, hell/dunkel) in drei Zuständen (Start, Daten + Kategorienbaum,
Zeile im Bearbeitungsmodus; zusätzlich ggf. geöffneter Dialog):
  - horizontaler Seitenüberlauf (document.scrollWidth > Viewportbreite)
  - sichtbare interaktive Elemente < 24 px (WCAG 2.5.8 AA-Minimum) und < 44 px (Komfortziel)
  - Elemente, die rechts/links aus dem Viewport ragen (ausgenommen scrollbare Container)
Es misst Geometrie, keine Kontraste und keine Screenreader-Ausgabe.
"""
import sys, json, os
from playwright.sync_api import sync_playwright

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else '.')
shots = None
if '--shots' in sys.argv:
    shots = sys.argv[sys.argv.index('--shots') + 1]
    os.makedirs(shots, exist_ok=True)

ROWS = [
    {"key": "Rubin", "wortart": "Nomen", "genus": "maskulin", "erst": True, "zweit": True, "stamm": "rubin",
     "nom_sg": "Rubin", "gen_sg": "Rubins", "plural": "Rubine", "fuge_erst": ",s", "fuge_zweit": ""},
    {"key": "Wolf", "wortart": "Nomen", "genus": "maskulin", "erst": True, "zweit": True, "stamm": "wolf",
     "nom_sg": "Wolf", "gen_sg": "Wolfs", "plural": "Wölfe", "fuge_erst": ",s", "fuge_zweit": ""},
]

CASES = [
    ("320x568-touch-light", 320, 568, True, "light"),
    ("360x800-touch-dark", 360, 800, True, "dark"),
    ("390x844-touch-light", 390, 844, True, "light"),
    ("600x900-touch-light", 600, 900, True, "light"),
    ("768x1024-touch-dark", 768, 1024, True, "dark"),
    ("900x700-mouse-light", 900, 700, False, "light"),
    ("1280x800-mouse-light", 1280, 800, False, "light"),
    ("1280x800-mouse-dark", 1280, 800, False, "dark"),
    ("812x375-touch-landscape", 812, 375, True, "light"),
]

MEASURE = """
() => {
  const vw = document.documentElement.clientWidth;
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button]';
  const seen = [];
  document.querySelectorAll(sel).forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (el.checkVisibility && !el.checkVisibility()) return;          // z. B. Inhalt geschlossener <details>
    if (el.type === 'file') return;                                    // Dropzone/Button darüber ist die Trefferfläche
    let r = el.getBoundingClientRect();
    // Checkbox/Radio mit <label>: die Beschriftung ist (mit) Trefferfläche
    if ((el.type === 'checkbox' || el.type === 'radio') && el.labels && el.labels.length) {
      const lr = el.labels[0].getBoundingClientRect();
      r = { width: Math.max(r.width, lr.width), height: Math.max(r.height, lr.height), right: r.right, left: r.left };
    }
    if (r.width === 0 || r.height === 0) return;
    let cls = (el.className && el.className.baseVal === undefined) ? el.className : '';
    const id = el.id ? '#' + el.id : '';
    seen.push({ tag: el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : ''), cls: String(cls).split(' ').slice(0, 2).join('.'), id,
                w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, right: Math.round(r.right), left: Math.round(r.left),
                label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) });
  });
  const under = (n) => seen.filter(x => x.w < n || x.h < n);
  const clip = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).display === 'none') return;
    if ((r.right > vw + 1 || r.left < -1) && !clip(el)) out.push((el.id || el.className || el.tagName).toString().slice(0, 40));
  });
  return { vw, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > vw + 1,
           n: seen.length, under24: under(24), under44n: under(44).length,
           under44: under(44).slice(0, 12).map(x => `${x.tag}.${x.cls}${x.id} ${x.w}x${x.h} "${x.label}"`),
           outsideViewport: out.slice(0, 8) };
}
"""

def run():
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name, w, h, touch, theme in CASES:
            ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch, device_scale_factor=1)
            ctx.add_init_script(f"try{{localStorage.setItem('ds-warm-theme','{theme}')}}catch(e){{}}")
            page = ctx.new_page()
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
            page.goto('file://' + root + '/index.html')
            page.wait_for_timeout(250)
            states = {}
            states['start'] = page.evaluate(MEASURE)
            if shots: page.screenshot(path=f'{shots}/{name}-1-start.png')
            page.evaluate("""(rows) => {
                let id = 'material';
                for (let i = 2; i <= 5; i++) id = taxAddNode(id, 'Sehr lange Kategoriebezeichnung für Ebene ' + i + ' mit vielen Wörtern');
                document.querySelector('#taxonomyPanel details').open = true;
                _panels.get('Nomen').importRows(rows, 'json');
            }""", ROWS)
            page.wait_for_timeout(250)
            states['daten+baum'] = page.evaluate(MEASURE)
            if shots: page.screenshot(path=f'{shots}/{name}-2-baum.png')
            try:
                page.click('tr[data-key="Rubin"] [data-action="edit"]', timeout=3000)
                page.wait_for_timeout(120)
                states['edit'] = page.evaluate(MEASURE)
                save = page.evaluate("""() => { const w = document.querySelector('.preview-wrap').getBoundingClientRect();
                    const s = document.querySelector('tr.row-editing [data-action=save]').getBoundingClientRect();
                    return { saveVisibleInWrap: s.right <= w.right + 1 && s.left >= w.left - 1 }; }""")
                states['edit']['saveVisibleInWrap'] = save['saveVisibleInWrap']
                if shots: page.screenshot(path=f'{shots}/{name}-3-edit.png')
            except Exception as e:
                states['edit'] = {'error': str(e)[:120]}
            # Dialog (nur wenn vorhanden): Kategorie löschen anstoßen
            try:
                page.once('dialog', lambda d: (states.__setitem__('nativeDialog', d.type), d.dismiss()))
                page.evaluate("document.querySelector('tr.row-editing [data-action=cancel]')?.click()")
                page.evaluate("document.querySelector('.tax-row[data-id=material] [data-tax-action=remove]').click()")
                page.wait_for_timeout(200)
                dlg = page.evaluate("""() => { const d = document.querySelector('dialog[open], .app-dialog[open], [role=dialog]'); if (!d) return null;
                    const r = d.getBoundingClientRect();
                    const btns = [...d.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0,24), w: Math.round(q.width), h: Math.round(q.height), inView: q.bottom <= innerHeight + 1 && q.right <= innerWidth + 1 && q.left >= -1 && q.top >= -1 }; });
                    return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], innerH: innerHeight, innerW: innerWidth, btns,
                             docOverflow: document.documentElement.scrollWidth > innerWidth + 1 }; }""")
                if dlg:
                    states['dialog'] = dlg
                    states['dialog']['measure'] = page.evaluate(MEASURE)
                    if shots: page.screenshot(path=f'{shots}/{name}-4-dialog.png')
            except Exception as e:
                states['dialog'] = {'error': str(e)[:120]}
            results.append({"case": name, "errors": errs, "states": states})
            ctx.close()
        browser.close()
    return results

if __name__ == '__main__':
    res = run()
    for r in res:
        print('==', r['case'], 'JS-Fehler:', r['errors'] or '-')
        for st, m in r['states'].items():
            if not isinstance(m, dict): print('  ', st, m); continue
            if 'error' in m: print('  ', st, 'FEHLER', m['error']); continue
            if st == 'dialog':
                print('   dialog rect', m['rect'], 'viewport', (m['innerW'], m['innerH']), 'buttons', m['btns'], 'docOverflow', m['docOverflow'])
                continue
            print(f"   {st:11s} overflow={m['overflow']} (sw {m['scrollWidth']}/{m['vw']}) interaktiv={m['n']} <24px={len(m['under24'])} <44px={m['under44n']}"
                  + (f" ausserhalb={m['outsideViewport']}" if m['outsideViewport'] else '')
                  + (f" saveInWrap={m.get('saveVisibleInWrap')}" if 'saveVisibleInWrap' in m else ''))
    json.dump(res, open('/tmp/ui-audit-last.json', 'w'), ensure_ascii=False, indent=1)
