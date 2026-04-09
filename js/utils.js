/**
 * utils.js
 * ──────────────────────────────────────────────────────────────────
 * Shared pure-function utilities.
 * No DOM access. No side effects.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

/** Trim and stringify any value. null/undefined → '' */
function str(v) {
  return String(v ?? '').trim();
}

/** Escape for safe HTML insertion. */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Coerce various truthy representations to a native boolean.
 * Handles: native bool, number 1/0, strings "true"/"false"/"1"/"0",
 * German "wahr"/"falsch".
 */
function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number')  return v !== 0;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'wahr';
}

/**
 * Parse a fuge cell value (comma-separated) into an array.
 *
 * Format: comma-separated within the cell value.
 *   ""      → [""]           (no-fuge only)
 *   ",s"    → ["", "s"]      (no-fuge + s-fuge)
 *   "e,s"   → ["e", "s"]     (two variants)
 *   "e"     → ["e"]          (one named variant)
 *
 * Returns null if raw is null/undefined/empty AND canUse is false.
 *
 * @param {string|null|undefined} raw   — cell value
 * @param {boolean} canUse              — whether this position is valid
 * @returns {string[]|null}
 */
function resolveFuge(raw, canUse) {
  if (!canUse) return null;

  // raw is absent or explicitly null/undefined → default: no-fuge
  if (raw === null || raw === undefined) return [''];

  const s = String(raw).trim();
  if (s === '') return [''];  // empty cell → no-fuge

  // Split on comma, preserve empty strings (represent no-fuge variant)
  return s.split(',').map(p => p.trim());
}

/** Trigger a browser file download. */
function triggerDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Trigger a binary download from an ArrayBuffer or Uint8Array. */
function triggerBinaryDownload(data, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([data], { type: mimeType });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
