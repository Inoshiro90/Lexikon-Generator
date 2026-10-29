/**
 * dialog.js
 * ──────────────────────────────────────────────────────────────────
 * Anwendungseigene Dialoge auf Basis des nativen <dialog>-Elements –
 * Ersatz für window.prompt / window.confirm / window.alert.
 *
 *   appDialog.prompt({ title, label, value, confirmLabel, submit })  → Promise<string|null>
 *   appDialog.confirm({ title, message, detail, confirmLabel, danger }) → Promise<boolean>
 *   appDialog.alert({ title, message })                               → Promise<void>
 *
 * Verhalten (WCAG 2.2: 2.1.1, 2.1.2, 2.4.3, 4.1.2):
 *  - showModal(): Hintergrund ist inert, Tab bleibt im Dialog, Escape bricht ab
 *  - Beschriftung über aria-labelledby (Titel), confirm/alert zusätzlich
 *    role="alertdialog" + aria-describedby (Text)
 *  - Anfangsfokus: Eingabefeld (prompt), bei destruktiven Bestätigungen die
 *    Schaltfläche „Abbrechen“ (sichere Vorgabe), sonst die Hauptaktion
 *  - Beim Schließen geht der Fokus zurück an das auslösende Element; wurde es
 *    inzwischen neu gerendert, stellt der Aufrufer den Fokus selbst wieder her
 *  - prompt: Enter bestätigt; leere Eingabe oder ein Fehler aus `submit` bleiben
 *    als Meldung im Dialog sichtbar (role="alert"), der Dialog bleibt offen
 *  - Kein Schließen per Klick auf den Hintergrund (verhindert versehentlichen
 *    Verlust von Eingaben und ungewollte Abbrüche)
 *  - Mehrere Aufrufe nacheinander werden in einer Warteschlange abgearbeitet
 * Abhängigkeiten: utils.js (escHtml), icons.js (icon). Stile: css/components/dialog.css
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

const appDialog = (function () {
  let _seq = 0;
  let _queue = Promise.resolve();

  /** Schließt den Dialog; ohne native close()-Unterstützung (ältere Umgebungen) manuell. */
  function _close(dlg, returnValue) {
    dlg.returnValue = returnValue;
    if (typeof dlg.close === 'function') {
      dlg.close(returnValue);
    } else {
      dlg.removeAttribute('open');
      dlg.dispatchEvent(new Event('close'));
    }
  }

  function _paragraphs(text) {
    return String(text == null ? '' : text).split(/\n{2,}/).filter(Boolean)
      .map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  }

  /**
   * Baut und zeigt einen Dialog.
   * spec: { id, title, size, role, form, bodyHtml, describedById, buttons[], initialFocus, onSubmit }
   * buttons: [{ label, value, variant, type }] – value = Rückgabewert (submit/Klick)
   * onSubmit(dlg, value) → false = offen lassen (Aufrufer zeigt Meldung),
   *                        { value } = schließen mit diesem Rückgabewert, sonst schließen
   */
  function _show(spec) {
    return new Promise((resolve) => {
      const id = `app-dlg-${++_seq}`;
      const opener = document.activeElement;
      const dlg = document.createElement('dialog');
      dlg.className = `dialog dialog--${spec.size || 'compact'}${spec.form ? ' dialog--form' : ''}`;
      if (spec.role) dlg.setAttribute('role', spec.role);
      dlg.setAttribute('aria-labelledby', `${id}-title`);
      if (spec.describedBy) dlg.setAttribute('aria-describedby', `${id}-body`);

      const buttons = spec.buttons.map((b, i) =>
        `<button type="${b.type || 'button'}" class="btn btn-${b.variant || 'secondary'}" data-dlg-value="${escHtml(b.value)}" data-dlg-i="${i}">${escHtml(b.label)}</button>`
      ).join('');

      dlg.innerHTML = `
        <form class="dialog-form" method="dialog" novalidate>
          <header class="dialog-header">
            <h2 class="dialog-title" id="${id}-title">${escHtml(spec.title)}</h2>
            <button type="button" class="btn btn-icon btn-ghost dialog-close" data-dlg-cancel aria-label="Schließen">${icon('x', 18)}</button>
          </header>
          <div class="dialog-body" id="${id}-body">${spec.bodyHtml}</div>
          <footer class="dialog-footer">${buttons}</footer>
        </form>`;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        const value = dlg.returnValue;
        dlg.remove();
        document.documentElement.classList.remove('has-dialog');
        // Fokus zurück an den Auslöser – falls er noch im Dokument ist (sonst übernimmt der Aufrufer)
        if (opener && opener !== document.body && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
        resolve(value);
      };
      dlg.addEventListener('close', finish);
      // Escape (nativ: cancel → close). Rückgabewert = Abbruch.
      dlg.addEventListener('cancel', () => { dlg.returnValue = ''; });
      dlg.addEventListener('keydown', (e) => {
        // Fallback ohne native Modalität: Escape selbst behandeln
        if (e.key === 'Escape' && typeof dlg.showModal !== 'function') { e.preventDefault(); _close(dlg, ''); }
      });

      dlg.querySelector('[data-dlg-cancel]').addEventListener('click', () => _close(dlg, ''));

      const form = dlg.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitter = e.submitter || dlg.querySelector('[type="submit"]');
        const value = submitter ? submitter.dataset.dlgValue : '';
        let result = value;
        if (spec.onSubmit) {
          const r = spec.onSubmit(dlg, value);
          if (r === false) return;                       // offen lassen (Meldung steht im Dialog)
          if (r && typeof r === 'object' && 'value' in r) result = r.value;
        }
        _close(dlg, result);
      });
      // Nicht-Submit-Buttons (z. B. „Abbrechen“) schließen mit ihrem Wert
      dlg.querySelectorAll('footer button[type="button"]').forEach((btn) => {
        btn.addEventListener('click', () => _close(dlg, btn.dataset.dlgValue));
      });

      document.body.appendChild(dlg);
      document.documentElement.classList.add('has-dialog');
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');

      const target = spec.initialFocus ? dlg.querySelector(spec.initialFocus) : dlg.querySelector('footer .btn-primary, footer .btn-danger');
      (target || dlg.querySelector('footer button')).focus();
      if (target && target.select && target.tagName === 'INPUT') target.select();
    });
  }

  function _enqueue(fn) {
    const run = _queue.then(fn);
    _queue = run.catch(() => {});
    return run;
  }

  /** Eingabedialog. Gibt den getrimmten Text oder null (Abbruch) zurück. */
  function prompt(opts) {
    const o = Object.assign({ title: 'Eingabe', label: 'Name', value: '', confirmLabel: 'OK', cancelLabel: 'Abbrechen', submit: null, emptyMessage: 'Bitte einen Namen eingeben.' }, opts);
    return _enqueue(() => {
      const fid = `app-dlg-field-${_seq + 1}`;
      return _show({
        title: o.title,
        size: 'compact',
        form: true,
        bodyHtml: `
          <div class="form-group mb-0">
            <label class="field-label" for="${fid}">${escHtml(o.label)}</label>
            <input type="text" class="form-input" id="${fid}" value="${escHtml(o.value)}" autocomplete="off" aria-describedby="${fid}-err">
            <p class="dialog-error" id="${fid}-err" role="alert"></p>
          </div>`,
        initialFocus: 'input',
        buttons: [
          { label: o.cancelLabel, value: '', variant: 'secondary' },
          { label: o.confirmLabel, value: 'ok', variant: 'primary', type: 'submit' },
        ],
        onSubmit(dlg) {
          const input = dlg.querySelector('input');
          const err = dlg.querySelector('.dialog-error');
          const v = input.value.trim();
          const fail = (msg) => { err.textContent = msg; input.setAttribute('aria-invalid', 'true'); input.focus(); return false; };
          if (!v) return fail(o.emptyMessage);
          if (o.submit) {
            try { o.submit(v); } catch (e) { return fail(e && e.message ? e.message : String(e)); }
          }
          input.removeAttribute('aria-invalid');
          return { value: v };                            // Rückgabe = eingegebener Text
        },
      }).then(rv => (rv === '' ? null : rv));            // '' = Abbruch (Escape, Schließen, Abbrechen)
    });
  }

  /** Bestätigungsdialog. danger: destruktive Aktion → rote Hauptschaltfläche, Fokus auf „Abbrechen“. */
  function confirm(opts) {
    const o = Object.assign({ title: 'Bestätigen', message: '', detail: '', confirmLabel: 'OK', cancelLabel: 'Abbrechen', danger: false }, opts);
    return _enqueue(() => _show({
      title: o.title,
      size: 'compact',
      role: 'alertdialog',
      describedBy: true,
      bodyHtml: _paragraphs(o.message) + (o.detail ? `<div class="dialog-detail">${_paragraphs(o.detail)}</div>` : ''),
      initialFocus: o.danger ? 'footer button[data-dlg-i="0"]' : null,
      buttons: [
        { label: o.cancelLabel, value: '', variant: 'secondary' },
        { label: o.confirmLabel, value: 'ok', variant: o.danger ? 'danger' : 'primary', type: 'submit' },
      ],
    }).then(rv => rv === 'ok'));
  }

  /** Hinweisdialog mit einer „OK“-Schaltfläche. */
  function alert(opts) {
    const o = Object.assign({ title: 'Hinweis', message: '', confirmLabel: 'OK' }, opts);
    return _enqueue(() => _show({
      title: o.title,
      size: 'compact',
      role: 'alertdialog',
      describedBy: true,
      bodyHtml: _paragraphs(o.message),
      buttons: [{ label: o.confirmLabel, value: 'ok', variant: 'primary', type: 'submit' }],
    }).then(() => undefined));
  }

  return { prompt, confirm, alert };
})();
