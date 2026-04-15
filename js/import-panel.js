/**
 * import-panel.js — supports all formats, ODS template download
 */
'use strict';

const WORTARTEN = [
	{key: 'Nomen', label: 'Nomen', iconName: 'book-open', rowParser: parseNomenRows, open: true},
	{key: 'Verb', label: 'Verben', iconName: 'zap', rowParser: parseVerbRows, open: false},
	{
		key: 'Adjektiv',
		label: 'Adjektive',
		iconName: 'sliders',
		rowParser: parseAdjektivRows,
		open: false,
	},
	{
		key: 'Präposition',
		label: 'Präpositionen',
		iconName: 'map-pin',
		rowParser: parseSimpleRows,
		open: false,
	},
	{key: 'Adverb', label: 'Adverbien', iconName: 'clock', rowParser: parseSimpleRows, open: false},
	{
		key: 'Partikel',
		label: 'Partikel',
		iconName: 'layers',
		rowParser: parseSimpleRows,
		open: false,
	},
];

const ACCEPTED_EXTENSIONS = '.csv,.tsv,.xlsx,.xls,.ods,.json,.xml,.md,.html,.htm,.txt';

function createImportPanel(config, callbacks = {}) {
	let _entries = [];
	let _activeTab = 'paste';

	const pid = `panel-${config.key.toLowerCase().replace(/[^a-z]/g, '')}`;
	const isOpen = config.open !== false;

	const el = document.createElement('article');
	el.className = 'import-panel';
	el.dataset.wortart = config.key;
	el.dataset.open = String(isOpen);

	el.innerHTML = `
    <header class="import-panel-header">
      <div class="import-panel-info">
        <span class="import-panel-icon" aria-hidden="true">${icon(config.iconName, 15)}</span>
        <span class="import-panel-name">${escHtml(config.label)}</span>
        <span class="stat-pill import-count" id="${pid}-count">0</span>
      </div>
      <button class="import-panel-toggle btn-icon" aria-expanded="${isOpen}"
              aria-controls="${pid}-body" title="${escHtml(config.label)} ein-/ausklappen">
        <span class="chevron-icon">${icon('chevron-down', 14)}</span>
      </button>
    </header>

    <div class="import-panel-body" id="${pid}-body" ${isOpen ? '' : 'hidden'}>

      <div class="mini-tabs" role="tablist">
        <button class="mini-tab active" role="tab" data-tab="paste"
                aria-selected="true" aria-controls="${pid}-paste">
          ${icon('clipboard', 13)} Einfügen
        </button>
        <button class="mini-tab" role="tab" data-tab="file"
                aria-selected="false" aria-controls="${pid}-file-panel">
          ${icon('upload', 13)} Datei
        </button>
      </div>

      <div class="import-section" id="${pid}-paste" role="tabpanel">
        <p class="format-hint-row">${icon('file-text', 11)}
          CSV · JSON · XML · Markdown · HTML · TSV</p>
        <textarea class="paste-area paste-area--sm" id="${pid}-textarea"
          placeholder="Daten einfügen — Format wird automatisch erkannt&#10;(CSV, JSON, XML, Markdown-Tabelle, HTML-Tabelle, TSV, …)"
          spellcheck="false" rows="4"></textarea>
        <div class="import-row">
          <button class="btn btn-primary btn-sm" id="${pid}-import-paste">
            ${icon('play', 13)} Importieren
          </button>
          <button class="btn btn-ghost btn-sm" id="${pid}-clear-paste" title="Leeren">
            ${icon('trash-2', 13)}
          </button>
          <span class="format-badge hidden" id="${pid}-fmt-badge"></span>
        </div>
      </div>

      <div class="import-section hidden" id="${pid}-file-panel" role="tabpanel">
        <div class="drop-zone drop-zone--sm" id="${pid}-dropzone">
          <input type="file" accept="${ACCEPTED_EXTENSIONS}" id="${pid}-file-input" tabindex="-1" />
          <span class="drop-icon" aria-hidden="true">${icon('upload', 20)}</span>
          <div class="drop-label">
            <strong>Datei wählen</strong> oder ablegen
            <span class="drop-formats">CSV · XLSX · ODS · JSON · XML · MD</span>
          </div>
        </div>
        <div class="import-row">
          <button class="btn btn-primary btn-sm" id="${pid}-import-file" disabled>
            ${icon('play', 13)} Importieren
          </button>
          <span class="format-badge hidden" id="${pid}-file-fmt-badge"></span>
        </div>
      </div>

      <div class="import-status hidden" id="${pid}-status"></div>

      <button class="btn btn-ghost btn-sm import-template-btn" id="${pid}-template">
        ${icon('download', 13)} ODS-Vorlage
      </button>
    </div>
  `;

	const header = el.querySelector('.import-panel-header');
	const toggleBtn = el.querySelector('.import-panel-toggle');
	const body = el.querySelector('.import-panel-body');
	const countPill = el.querySelector('.import-count');
	const miniTabs = el.querySelectorAll('.mini-tab');
	const pasteSection = el.querySelector(`#${pid}-paste`);
	const fileSection = el.querySelector(`#${pid}-file-panel`);
	const textarea = el.querySelector(`#${pid}-textarea`);
	const fileInput = el.querySelector(`#${pid}-file-input`);
	const dropZone = el.querySelector(`#${pid}-dropzone`);
	const importPasteBtn = el.querySelector(`#${pid}-import-paste`);
	const clearBtn = el.querySelector(`#${pid}-clear-paste`);
	const fmtBadgePaste = el.querySelector(`#${pid}-fmt-badge`);
	const importFileBtn = el.querySelector(`#${pid}-import-file`);
	const fmtBadgeFile = el.querySelector(`#${pid}-file-fmt-badge`);
	const statusEl = el.querySelector(`#${pid}-status`);
	const templateBtn = el.querySelector(`#${pid}-template`);

	// ── Accordion
	header.addEventListener('click', (e) => {
		if (e.target.closest('button') && !e.target.closest('.import-panel-toggle')) return;
		_setOpen(el.dataset.open !== 'true');
	});

	function _setOpen(open) {
		el.dataset.open = String(open);
		toggleBtn.setAttribute('aria-expanded', String(open));
		open ? body.removeAttribute('hidden') : body.setAttribute('hidden', '');
	}

	// ── Mini Tabs
	miniTabs.forEach((tab) => {
		tab.addEventListener('click', () => {
			_activeTab = tab.dataset.tab;
			miniTabs.forEach((t) => {
				t.classList.toggle('active', t.dataset.tab === _activeTab);
				t.setAttribute('aria-selected', String(t.dataset.tab === _activeTab));
			});
			pasteSection.classList.toggle('hidden', _activeTab !== 'paste');
			fileSection.classList.toggle('hidden', _activeTab !== 'file');
		});
	});

	// ── Status helpers
	function _setStatus(type, msg) {
		statusEl.className = `import-status ${type}`;
		statusEl.innerHTML = msg;
		statusEl.classList.remove('hidden');
	}
	function _clearStatus() {
		statusEl.className = 'import-status hidden';
		statusEl.innerHTML = '';
	}
	function _updateCount(n) {
		countPill.textContent = String(n);
		countPill.classList.toggle('stat-pill--active', n > 0);
	}
	function _showFmtBadge(badge, fmt) {
		badge.textContent = formatLabel(fmt);
		badge.classList.remove('hidden');
	}

	// ── Core: rows[] → entries[]                          // geändert: Validierung pro Eintrag
	function _importRows(rows, fmt) {
		_clearStatus();
		try {
			const parsed = config.rowParser(rows);
			if (!parsed.length) {
				_setStatus(
					'warn',
					`${icon('alert-triangle', 12)} Keine gültigen Einträge gefunden.`,
				);
				return;
			}

			// hinzugefügt: Validierung jedes Eintrags vor Übernahme ins Datenmodell
			const valid = [];
			const errMsgs = [];
			parsed.forEach(({key, entry}) => {
				const result = validateEntry(key, entry);
				if (result.valid) {
					valid.push({key, entry});
				} else {
					result.errors.forEach((err) =>
						errMsgs.push(`Fehler beim Import von "${key}": ${err}`),
					);
				}
			});

			if (errMsgs.length) {
				const html = errMsgs
					.map(
						(m) =>
							`<div class="val-item err">${icon('x-circle', 11)} ${escHtml(m)}</div>`,
					)
					.join('');
				_setStatus('error', html);
				if (!valid.length) return; // alle ungültig → abbrechen
			}

			if (valid.length) {
				if (!errMsgs.length) {
					_setStatus(
						'success',
						`${icon('check', 12)} <strong>${valid.length}</strong> ` +
							`Eintr${valid.length !== 1 ? 'äge' : 'ag'} — ${escHtml(formatLabel(fmt))}`,
					);
				}
				_entries = valid;
				_updateCount(valid.length);
				if (callbacks.onImport) callbacks.onImport(config.key, valid);
			}
		} catch (err) {
			_setStatus('error', `${icon('x-circle', 12)} ${escHtml(err.message)}`);
		}
	}

	// ── Paste
	function _runPasteImport() {
		const text = textarea.value;
		if (!text.trim()) {
			_setStatus('warn', `${icon('alert-triangle', 12)} Eingabe ist leer.`);
			return;
		}
		try {
			const {rows, formatUsed} = normalizeText(text, '');
			_showFmtBadge(fmtBadgePaste, formatUsed);
			_importRows(rows, formatUsed);
		} catch (err) {
			_setStatus('error', `${icon('x-circle', 12)} ${escHtml(err.message)}`);
		}
	}
	importPasteBtn.addEventListener('click', _runPasteImport);
	textarea.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			_runPasteImport();
		}
	});
	clearBtn.addEventListener('click', () => {
		textarea.value = '';
		textarea.focus();
	});

	// ── File upload
	let _pendingFile = null;

	function _setFile(file) {
		_pendingFile = file;
		const szLabel = file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`;
		dropZone.querySelector('.drop-label').innerHTML =
			`<strong>${escHtml(file.name)}</strong><span class="drop-formats">${szLabel}</span>`;
		importFileBtn.disabled = false;
		const extFmt = detectFormatByExtension(file.name);
		if (extFmt && extFmt !== 'auto') _showFmtBadge(fmtBadgeFile, extFmt);
	}

	dropZone.addEventListener('click', (e) => {
		if (e.target.closest('input[type="file"]')) return;
		fileInput.click();
	});
	dropZone.addEventListener('dragover', (e) => {
		e.preventDefault();
		dropZone.classList.add('drag-over');
	});
	dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
	dropZone.addEventListener('drop', (e) => {
		e.preventDefault();
		dropZone.classList.remove('drag-over');
		if (e.dataTransfer.files[0]) _setFile(e.dataTransfer.files[0]);
	});
	fileInput.addEventListener('change', () => {
		if (fileInput.files[0]) _setFile(fileInput.files[0]);
		fileInput.value = '';
	});

	importFileBtn.addEventListener('click', () => {
		if (!_pendingFile) return;
		const fmt = detectFormatByExtension(_pendingFile.name);

		if (fmt === 'spreadsheet') {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const {rows, formatUsed} = normalizeBinary(e.target.result);
					_showFmtBadge(fmtBadgeFile, formatUsed);
					_importRows(rows, formatUsed);
				} catch (err) {
					_setStatus('error', `${icon('x-circle', 12)} ${escHtml(err.message)}`);
				}
			};
			reader.onerror = () =>
				_setStatus('error', `${icon('x-circle', 12)} Datei nicht lesbar.`);
			reader.readAsArrayBuffer(_pendingFile);
		} else {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const {rows, formatUsed} = normalizeText(e.target.result, _pendingFile.name);
					_showFmtBadge(fmtBadgeFile, formatUsed);
					_importRows(rows, formatUsed);
				} catch (err) {
					_setStatus('error', `${icon('x-circle', 12)} ${escHtml(err.message)}`);
				}
			};
			reader.onerror = () =>
				_setStatus('error', `${icon('x-circle', 12)} Datei nicht lesbar.`);
			reader.readAsText(_pendingFile, 'utf-8');
		}
	});

	// ── ODS Template
	templateBtn.addEventListener('click', () => downloadODSTemplate(config.key));

	return {
		el,
		getEntries() {
			return _entries;
		},
		clear() {
			_entries = [];
			_updateCount(0);
			_clearStatus();
		},

		// hinzugefügt: Eintrag im Panel aktualisieren (nach Inline-Bearbeitung)
		updateEntry(key, updatedEntry) {
			const idx = _entries.findIndex((e) => e.key === key);
			if (idx === -1) return false;
			_entries[idx] = {key, entry: updatedEntry};
			_updateCount(_entries.length);
			return true;
		},

		// hinzugefügt: Eintrag aus Panel entfernen
		removeEntry(key) {
			const before = _entries.length;
			_entries = _entries.filter((e) => e.key !== key);
			_updateCount(_entries.length);
			if (_entries.length < before) {
				console.log(`[Lexikon] Eintrag "${key}" erfolgreich entfernt.`);
				return true;
			}
			return false;
		},
	};
}
