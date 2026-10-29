/**
 * Optionale Layoutprüfung in einem echten Browser (Playwright/Chromium), nicht Teil von `npm test`:
 *   npx playwright install chromium   (einmalig)   →   node tools/layout-check.cjs
 * Prüft bei 320/375/768/1280 px (Touch/Maus, hell/dunkel): keine Seitenüberbreite, 44-px-Trefferflächen auf
 * Touchgeräten, Aktionen ohne Hover sichtbar, Speichern-Schaltfläche in der Tabelle erreichbar.
 * Schreibt Screenshots nach /tmp/pw (Pfad unten anpassen).
 */
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
require('fs').mkdirSync('/tmp/pw', { recursive: true });
const path = require('path').resolve(__dirname, '..', 'index.html');
const rows = [
  { key: 'Rubin', wortart: 'Nomen', genus: 'maskulin', erst: true, zweit: true, stamm: 'rubin', nom_sg: 'Rubin', gen_sg: 'Rubins', plural: 'Rubine', fuge_erst: ',s', fuge_zweit: '', Kategorie_1: 'Material', Kategorie_2: 'Edelstein' },
  { key: 'Wolf', wortart: 'Nomen', genus: 'maskulin', erst: true, zweit: true, stamm: 'wolf', nom_sg: 'Wolf', gen_sg: 'Wolfs', plural: 'Wölfe', fuge_erst: ',s', fuge_zweit: '' },
];
(async () => {
  const browser = await chromium.launch();
  const cases = [
    { name: '320-touch-light', vp: { width: 320, height: 640 }, touch: true, theme: 'light' },
    { name: '375-touch-dark',  vp: { width: 375, height: 667 }, touch: true, theme: 'dark' },
    { name: '768-touch-light', vp: { width: 768, height: 1024 }, touch: true, theme: 'light' },
    { name: '1280-mouse-light', vp: { width: 1280, height: 900 }, touch: false, theme: 'light' },
    { name: '1280-mouse-dark', vp: { width: 1280, height: 900 }, touch: false, theme: 'dark' },
  ];
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: c.vp, hasTouch: c.touch, isMobile: c.touch, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ds-warm-theme', t); } catch (e) {} }, c.theme);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto('file://' + path);
    await page.waitForTimeout(300);
    // Kategorienbaum öffnen, tiefen Baum + langen Namen anlegen
    await page.evaluate(() => {
      let id = 'material';
      for (let i = 2; i <= 5; i++) id = taxAddNode(id, 'Sehr lange Kategoriebezeichnung für Ebene ' + i + ' mit vielen Wörtern');
      document.querySelector('#taxonomyPanel details').open = true;
    });
    await page.evaluate((r) => { _panels.get('Nomen').importRows(r, 'json'); }, rows);
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const rect = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), l: Math.round(b.left), r: Math.round(b.right) }; };
      const btns = [...document.querySelectorAll('.tax-row .tax-btn')];
      const small = btns.filter((b) => { const r = rect(b); return r.w < 44 || r.h < 44; }).length;
      const row = document.querySelector('.tax-row[data-id="material"]');
      const deepRow = [...document.querySelectorAll('.tax-row')].find((x) => x.dataset.id.split('.').length >= 5);
      const act = row.querySelector('.tax-actions');
      return {
        pageOverflow: document.documentElement.scrollWidth > vw,
        scrollWidth: document.documentElement.scrollWidth, vw,
        taxBtnCount: btns.length, taxBtnsUnder44: small,
        minTaxBtn: btns.length ? Math.min(...btns.map((b) => Math.min(rect(b).w, rect(b).h))) : null,
        actionsOpacity: getComputedStyle(act).opacity,
        deepRowName: deepRow ? rect(deepRow.querySelector('.tax-name')) : null,
        deepRowInside: deepRow ? (rect(deepRow).r <= vw + 1) : null,
        actionsInside: rect(act).r <= vw + 1,
        previewVisible: !document.getElementById('previewCard').classList.contains('hidden'),
        editBtn: (() => { const b = document.querySelector('.preview-action-btn'); return b ? rect(b) : null; })(),
        actionsCellRight: (() => { const c = document.querySelector('td.col-actions'); return c ? rect(c) : null; })(),
      };
    });
    await page.screenshot({ path: `/tmp/pw/${c.name}-tree.png`, fullPage: false });
    // Vorschau: bearbeiten
    await page.evaluate(() => document.querySelector('#previewBody').scrollIntoView());
    await page.click('tr[data-key="Rubin"] [data-action="edit"]');
    await page.waitForTimeout(100);
    const e = await page.evaluate(() => {
      const wrap = document.querySelector('.preview-wrap');
      const tr = document.querySelector('tr.row-editing');
      const sel = tr.querySelector('[data-kat-level="1"]');
      const save = tr.querySelector('[data-action="save"]');
      const sb = save.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
      return { wrapScrollable: wrap.scrollWidth > wrap.clientWidth, saveVisibleInWrap: sb.right <= wb.right + 1 && sb.left >= wb.left - 1,
               saveSize: [Math.round(sb.width), Math.round(sb.height)], katSelectH: Math.round(sel.getBoundingClientRect().height),
               pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    await page.screenshot({ path: `/tmp/pw/${c.name}-table.png`, fullPage: false });
    console.log(c.name, JSON.stringify({ ...m, edit: e, errs }));
    await ctx.close();
  }
  await browser.close();
})();
