#!/usr/bin/env python3
"""
Browser-E2E (Playwright/Chromium) für Dialoge, Tastaturbedienung und Layout – kein Teil von `npm test`
(jsdom kennt showModal/Fokusfalle/Layout nicht). Aufruf: python3 tools/ui-e2e.py [Projektordner]
Jede Prüfung druckt PASS/FAIL; Exit-Code 1 bei Fehlern.
"""
import sys, os
from playwright.sync_api import sync_playwright

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
results = []
def check(name, ok, info=''):
    results.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

ROWS = [{"key": "Rubin", "wortart": "Nomen", "genus": "maskulin", "erst": True, "zweit": True, "stamm": "rubin",
         "nom_sg": "Rubin", "gen_sg": "Rubins", "plural": "Rubine", "fuge_erst": ",s", "fuge_zweit": ""}]

def new_page(b, w=1280, h=800, touch=False, **kw):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, **kw)
    p = ctx.new_page(); errs = []; p.set_default_timeout(4000)
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('dialog', lambda d: (errs.append('NATIVER DIALOG ' + d.type), d.dismiss()))
    p.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    p.goto('file://' + root + '/index.html'); p.wait_for_timeout(250)
    p.evaluate("document.querySelector('#taxonomyPanel details').open = true")
    return ctx, p, errs

IN_DLG = "() => document.activeElement === document.body || !!document.activeElement.closest('dialog[open]')"
ACTIVE = "() => { const a = document.activeElement; return a.tagName + (a.dataset.taxAction ? '[' + a.dataset.taxAction + ']' : '') + '.' + (a.className||'') }"

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- Desktop: Dialog per Tastatur -------------------------------------------------
    ctx, p, errs = new_page(b)
    p.focus('[data-tax-action="add-root"]'); p.keyboard.press('Enter'); p.wait_for_timeout(150)
    check('Dialog öffnet per Enter, modal (showModal)', p.evaluate("() => document.querySelector('dialog[open]')?.matches(':modal') === true"))
    check('Anfangsfokus im Eingabefeld', p.evaluate("() => document.activeElement.matches('dialog input')"))
    stay = True
    for i in range(12):
        p.keyboard.press('Tab'); stay &= p.evaluate(IN_DLG)
    check('Fokusfalle: 12× Tab erreicht nie ein Element außerhalb des Dialogs', stay)
    stay = True
    for i in range(12):
        p.keyboard.press('Shift+Tab'); stay &= p.evaluate(IN_DLG)
    check('Fokusfalle: 12× Shift+Tab erreicht nie ein Element außerhalb des Dialogs', stay)
    check('Hintergrund inert (Klick auf Seite erreicht ihn nicht)', p.evaluate("() => { const t = document.querySelector('#themeToggle'); const r = t.getBoundingClientRect(); return document.elementFromPoint(r.left + 5, r.top + 5)?.closest('dialog') !== null || document.elementFromPoint(r.left + 5, r.top + 5) === document.querySelector('dialog'); }"))
    check('Scrollsperre: html.has-dialog', p.evaluate("() => document.documentElement.classList.contains('has-dialog')"))
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check('Escape schließt, Fokus zurück auf „+ Oberkategorie“', p.evaluate("() => !document.querySelector('dialog') && document.activeElement.dataset.taxAction === 'add-root'"))
    # Enter im Feld legt an
    n0 = p.evaluate("taxFlatten().length")
    p.keyboard.press('Enter'); p.wait_for_timeout(150)
    p.keyboard.type('Tastaturwelt'); p.keyboard.press('Enter'); p.wait_for_timeout(200)
    check('Enter im Eingabefeld bestätigt und legt Kategorie an', p.evaluate("taxFlatten().length") == n0 + 1 and p.evaluate("!document.querySelector('dialog')"))
    check('Fokus nach Anlegen wieder im Panel (auf „+ Oberkategorie“)', p.evaluate("() => document.activeElement.dataset.taxAction === 'add-root'"))
    # Löschen: Enter auf vorfokussiertem „Abbrechen“ löscht NICHT
    p.focus('.tax-row[data-id="material"] [data-tax-action="remove"]'); p.keyboard.press('Enter'); p.wait_for_timeout(150)
    check('Löschen-Dialog: Anfangsfokus auf „Abbrechen“', p.evaluate("() => document.activeElement.textContent.trim() === 'Abbrechen'"))
    p.keyboard.press('Enter'); p.wait_for_timeout(150)
    check('Enter auf „Abbrechen“ löscht nichts, Fokus zurück am Löschen-Button',
          p.evaluate("() => !!document.querySelector('.tax-row[data-id=material]') && document.activeElement.dataset.taxAction === 'remove'"))
    # Teilbaum-Checkbox per Leertaste: Fokus bleibt
    p.focus('.tax-row[data-id="material"] [data-tax-action="flag"]'); p.keyboard.press('Space'); p.wait_for_timeout(100)
    check('Leertaste auf Teilbaum-Checkbox: Wert gesetzt, Fokus bleibt auf der Checkbox',
          p.evaluate("() => document.activeElement.matches('.tax-row[data-id=material] [data-tax-action=flag]') && document.activeElement.checked === true"))
    check('keine JS-Fehler / keine nativen Dialoge (Desktop)', errs == [], str(errs))
    ctx.close()

    # ---- Vorschau: Speichern per Enter, Fokus ------------------------------------------
    ctx, p, errs = new_page(b)
    p.evaluate("(r) => _panels.get('Nomen').importRows(r, 'json')", ROWS); p.wait_for_timeout(200)
    p.focus('tr[data-key="Rubin"] [data-action="edit"]'); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    p.keyboard.press('Tab'); p.keyboard.press('Control+A'); p.keyboard.type('x'); p.keyboard.press('Enter'); p.wait_for_timeout(200)
    check('Zeile: Speichern per Enter → Fokus auf „Bearbeiten“ derselben Zeile',
          p.evaluate("() => document.activeElement.dataset.action === 'edit' && document.activeElement.closest('tr').dataset.key === 'Rubin'"))
    ctx.close()

    # ---- Datei-Input per Tastatur ------------------------------------------------------
    ctx, p, errs = new_page(b)
    p.evaluate("() => { const pn = document.querySelector('.import-panel'); if (pn.dataset.open !== 'true') pn.querySelector('.import-panel-header').click(); }")
    p.wait_for_timeout(100)
    p.evaluate("document.querySelector('[role=tab][data-tab=file]').focus()")
    p.keyboard.press('Enter'); p.wait_for_timeout(50)
    p.keyboard.press('Tab'); p.wait_for_timeout(50)
    check('Tab erreicht den Datei-Input der Dropzone (Fokusring an der Zone)',
          p.evaluate("() => document.activeElement.type === 'file' && getComputedStyle(document.activeElement.closest('.drop-zone')).outlineStyle === 'solid'"))
    ctx.close()

    # ---- Mobile Dialoge: Bottom-Sheet, Scrollen, Safe-Area -----------------------------
    for (w, h, label) in [(320, 568, '320×568'), (390, 844, '390×844')]:
        ctx, p, errs = new_page(b, w, h, touch=True)
        p.evaluate("(() => { appDialog.alert({title:'Lang', message: Array.from({length: 40}, (_, i) => 'Zeile ' + i + ' mit etwas längerem Text zum Umbrechen.').join('\\n\\n')}); })()"); p.wait_for_timeout(500)   # Einblendanimation (250 ms) abwarten
        g = p.evaluate("""() => { const d = document.querySelector('dialog[open]'); const r = d.getBoundingClientRect(); const body = d.querySelector('.dialog-body'); const f = d.querySelector('.dialog-footer').getBoundingClientRect(); const hd = d.querySelector('.dialog-header').getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, bodyScroll: body.scrollHeight > body.clientHeight, footBottom: f.bottom, headTop: hd.top, pageScrollX: document.documentElement.scrollWidth > innerWidth }; }""")
        check(f'{label}: Bottom-Sheet bündig unten und volle Breite', abs(g['bottom'] - g['vh']) <= 1 and g['left'] == 0 and g['right'] == g['vw'], str(g))
        check(f'{label}: langer Inhalt scrollt im Dialog, Kopf/Fuß bleiben sichtbar', g['bodyScroll'] and g['headTop'] >= 0 and g['footBottom'] <= g['vh'] + 1)
        check(f'{label}: kein horizontaler Seitenüberlauf', not g['pageScrollX'])
        btn = p.evaluate("() => { const b = document.querySelector('dialog[open] [type=submit]').getBoundingClientRect(); return [b.width, b.height]; }")
        check(f'{label}: Hauptaktion ≥ 44 px hoch und volle Breite', btn[1] >= 44 and btn[0] > w - 40, str(btn))
        check(f'{label}: Schließen-Button Trefferfläche ≥ 44×44',
              p.evaluate("() => { const b = document.querySelector('dialog .dialog-close').getBoundingClientRect(); return b.width >= 44 && b.height >= 44; }"))
        ctx.close()

    # niedriger Viewport (Querformat, Tastatur sichtbar simuliert über Höhe)
    for (w, h, label) in [(568, 320, 'Querformat 568×320'), (812, 375, 'Querformat 812×375'), (390, 300, '390×300 (Tastatur offen)')]:
        ctx, p, errs = new_page(b, w, h, touch=True)
        p.evaluate("(() => { appDialog.confirm({title:'Kategorie löschen', message:'Sehr langer Text '.repeat(40), detail:'Noch mehr Details '.repeat(20), confirmLabel:'Kategorie endgültig löschen', danger:true}); })()"); p.wait_for_timeout(500)
        g = p.evaluate("""() => { const d = document.querySelector('dialog[open]'); const r = d.getBoundingClientRect(); const btns = [...d.querySelectorAll('footer .btn')].map(b => { const q = b.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight + 1 && q.left >= 0 && q.right <= innerWidth + 1; });
            return { top: r.top, bottom: r.bottom, vh: innerHeight, btnsInView: btns.every(Boolean), headInView: d.querySelector('.dialog-header').getBoundingClientRect().top >= 0 }; }""")
        check(f'{label}: Dialog passt in den Viewport, Aktionen und Kopf erreichbar', g['top'] >= 0 and g['bottom'] <= g['vh'] + 1 and g['btnsInView'] and g['headInView'], str(g))
        ctx.close()
    # Eingabedialog: Feld liegt oben (nicht hinter der Tastatur)
    ctx, p, errs = new_page(b, 390, 844, touch=True)
    p.evaluate("document.querySelector('[data-tax-action=add-root]').click()"); p.wait_for_timeout(200)
    top = p.evaluate("() => document.querySelector('dialog input').getBoundingClientRect().top")
    check('390×844: Eingabedialog oben ausgerichtet (Feld im oberen Drittel)', top < 844 / 3, f'input.top={top:.0f}')
    ctx.close()

    # ---- Sticky-Verdeckung bei Tastaturnavigation -------------------------------------
    ctx, p, errs = new_page(b, 390, 844, touch=True)
    p.evaluate("(r) => _panels.get('Nomen').importRows(r, 'json')", ROWS); p.wait_for_timeout(200)
    obscured = []
    p.add_style_tag(content="html { scroll-behavior: auto !important; }")   # Messung nicht mitten im Smooth-Scroll
    p.evaluate("document.activeElement.blur(); window.scrollTo(0, 0)")
    for i in range(70):
        p.keyboard.press('Tab'); p.wait_for_timeout(15)
        r = p.evaluate("""() => { const a = document.activeElement; if (!a || a === document.body) return null; const q = a.getBoundingClientRect();
            const hdr = document.querySelector('.app-header').getBoundingClientRect(); const g = document.getElementById('generateBtn'); const gr = g.getBoundingClientRect();
            const inter = (x, y) => !(x.right <= y.left || x.left >= y.right || x.bottom <= y.top || x.top >= y.bottom);
            const clipByWrap = a.closest('.preview-wrap'); const inHdr = !!a.closest('.app-header');
            return { id: a.id || a.className || a.tagName, hdr: !inHdr && inter(q, hdr) && q.height > 0 && q.top < hdr.bottom - 1, gen: a !== g && inter(q, gr) && q.height > 0 && !clipByWrap }; }""")
        if r and (r['hdr'] or r['gen']): obscured.append(r)
    check('390×844: 70× Tab – fokussierte Elemente werden weder vom Header noch vom Generieren-Button verdeckt', not obscured, str(obscured[:3]))
    ctx.close()

    # ---- Reduzierte Bewegung -----------------------------------------------------------
    ctx, p, errs = new_page(b, reduced_motion='reduce')
    anim = p.evaluate("() => getComputedStyle(document.querySelector('.card')).animationName")
    p.evaluate("document.querySelector('[data-tax-action=remove]').click()"); p.wait_for_timeout(120)
    danim = p.evaluate("() => getComputedStyle(document.querySelector('dialog[open]')).animationName")
    tdur = p.evaluate("() => getComputedStyle(document.querySelector('.btn')).transitionDuration")
    check('prefers-reduced-motion: Karten/Dialog blenden nur ein (kein Verschieben/Skalieren)', anim == 'fadeIn' and danim == 'fadeIn', f'{anim}/{danim}')
    check('prefers-reduced-motion: Button-Übergänge praktisch sofort', all(float(x.replace("s", "")) <= 0.001 for x in tdur.split(',')), tdur)
    ctx.close()

    # ---- Zoom / Textvergrößerung: 320 px Breite, 200 % Schrift ---------------------------
    ctx, p, errs = new_page(b, 320, 568, touch=True)
    p.add_style_tag(content="html { font-size: 200% !important; }")
    p.evaluate("(r) => _panels.get('Nomen').importRows(r, 'json')", ROWS); p.wait_for_timeout(250)
    p.evaluate("document.querySelector('[data-tax-action=remove]').click()"); p.wait_for_timeout(200)
    g = p.evaluate("""() => { const d = document.querySelector('dialog[open]'); const r = d.getBoundingClientRect(); const btns = [...d.querySelectorAll('footer .btn')].map(b => { const q = b.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth + 1 && q.height >= 44 && b.scrollWidth <= b.clientWidth + 1; });
        return { fits: r.top >= 0 && r.bottom <= innerHeight + 1, btns: btns.every(Boolean), pageX: document.documentElement.scrollWidth > innerWidth }; }""")
    check('320 px + 200 % Schrift: Dialog im Viewport, Buttons nicht abgeschnitten', g['fits'] and g['btns'], str(g))
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check('320 px + 200 % Schrift: kein horizontaler Seitenüberlauf', not p.evaluate("() => document.documentElement.scrollWidth > innerWidth"))
    ctx.close()
    b.close()

print(f"\n{sum(results)}/{len(results)} Prüfungen bestanden")
sys.exit(0 if all(results) else 1)
