// Interaction prototype only. No application API, file-content reads or model calls.
const content = document.querySelector('#content');
const modal = document.querySelector('#modal');
const announcement = document.querySelector('#announcement');
const sampleDescription = 'A 1999-cent item with a 15% discount now costs 1700 cents. It should cost 1699 cents. This started after a pricing refactor. Find the change that explains the extra cent.';
const sampleLog = 'item=checkout-item price_cents=1999 discount=0.15\nexpected_total_cents=1699 actual_total_cents=1700\n';
const setups = {
  personal: { name: 'Personal setup', path: '/home/demo/.codex-plus' },
  work: { name: 'Work setup', path: '/home/demo/.codex' }
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const size = bytes => bytes < 1024 ? `${bytes} B` : `${Math.ceil(bytes / 1024)} KB`;
const limit = 1024 * 1024;
let nextId = 0, timer, running = false, epoch = 0, modalOpener, launchAfterSetup = false;
let scenario = 'success', phase = 0, screen = 'draft', notice = '', error = '', selectedVersion = 0;
let draft = newDraft();
const cases = [];
function newDraft(repository = '', setup = null) {
  return { id: ++nextId, repository, description: '', files: [], setup, model: 'default', feedback: '', reports: [] };
}
function announce(message) { announcement.textContent = message; }
function rememberDraft() { if ((draft.description || draft.files.length) && !cases.includes(draft)) cases.push(draft); }
function modelLabel() { return draft.model === 'default' ? 'Codex defaults' : 'Saved medium profile'; }
function title() { return draft.description.trim().split('\n')[0].slice(0, 70) || 'New investigation'; }
function fieldSummary() {
  return `<dl class="summary-grid"><dt>Code</dt><dd>${escape(draft.repository)}</dd><dt>Setup</dt><dd>${escape(setups[draft.setup]?.name || 'Not selected')} · ${escape(modelLabel())}</dd><dt>Files</dt><dd>${draft.files.filter(f => f.included).length} included in this preview</dd></dl>`;
}
function render(focus = true) {
  document.querySelector('#breadcrumb').textContent = screen === 'draft' ? 'New investigation' : screen === 'progress' ? 'In progress' : 'Sample report';
  document.querySelector('#history').innerHTML = cases.length ? cases.map(item => `<button class="history-item" data-action="open-case" data-id="${item.id}" ${running ? 'disabled' : ''}>${escape(item.description.slice(0, 43) || 'Untitled draft')}<small>${item.reports.length ? `Sample report · ${item.reports.length} version${item.reports.length === 1 ? '' : 's'}` : 'Draft'}</small></button>`).join('') : '';
  // No inline handlers or user-provided markup are used in this preview.
  content.innerHTML = screen === 'draft' ? composer() : screen === 'progress' ? progress() : report();
  if (focus) content.focus({ preventScroll: false });
}
function composer() {
  return `<div class="page-heading"><div><h1>New investigation</h1><p>Describe a problem. Follow the code and its history.</p></div><button class="text-button" data-action="sample">Try a sample ↗</button></div>
    ${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}
    ${error ? errorPanel() : ''}
    <form id="composer" class="card" aria-label="New investigation">
      <div class="field"><label for="repository">Repository path or Git URL</label><input id="repository" name="repository" value="${escape(draft.repository)}" placeholder="/path/to/your/project" required maxlength="4096" aria-describedby="repository-hint"><small id="repository-hint">The real app will use committed code in an isolated copy. This preview does not access the repository.</small></div>
      <div class="field"><label for="description">What is going wrong?</label><textarea id="description" name="description" placeholder="Describe the problem or paste the issue here. What happened, and what did you expect?" required maxlength="65536">${escape(draft.description)}</textarea></div>
      <div class="field"><div class="label-row"><label for="files">Supporting files <span class="optional">Optional</span></label><button type="button" class="text-button" data-action="sample-log">Add sample log</button></div>
        <div class="drop-zone" id="drop-zone"><button type="button" class="text-button" data-action="browse">Add files</button> or drop logs and text here<small>Preview uses filenames and sizes only. File contents stay unread.</small><input type="file" id="files" multiple hidden></div>
        <div id="attachments">${attachments()}</div>
      </div>
      <div class="setup-strip"><div><div class="setup-label">ANALYZE WITH</div><p>${draft.setup ? `<strong>${escape(setups[draft.setup].name)}</strong> · ${escape(modelLabel())}` : '<strong>Choose your Codex setup</strong>'}</p><small>${draft.setup ? 'Sample selection · remembered in this page session' : 'Choose once. We will remember it for this project.'}</small></div><button type="button" class="secondary" data-action="setup">${draft.setup ? 'Change' : 'Choose setup'}</button></div>
      <details class="disclosure"><summary>Advanced options</summary><label for="model">Model settings</label><select id="model"><option value="default" ${draft.model === 'default' ? 'selected' : ''}>Codex defaults</option><option value="medium" ${draft.model === 'medium' ? 'selected' : ''}>Saved medium profile (sample)</option></select><p>${draft.setup ? `Selected sample directory: <code>${escape(setups[draft.setup].path)}</code>.` : 'Select a setup to see its sample directory.'} No credentials are inspected.</p><p>In the real app, code and selected text can be sent through this setup. This preview sends neither.</p></details>
      <div class="submit-row"><p>Read-only analysis. Your checkout stays unchanged.<br>This preview produces a fixed sample report.</p><button type="submit" class="primary">Investigate <span aria-hidden="true">→</span></button></div>
    </form>`;
}
function attachments() {
  return draft.files.map(file => `<div class="attachment"><span class="file-icon" aria-hidden="true">${file.kind === 'unsupported' ? 'FILE' : 'TXT'}</span><div class="attachment-info"><strong>${escape(file.name)}</strong><small class="${file.included ? 'included' : 'excluded'}">${size(file.size)} · ${file.included ? file.kind === 'sample' ? 'Included · sample text' : 'Would include full text · preview only' : file.kind === 'unsupported' ? 'Not included · this format is not analyzed' : file.kind === 'large' ? 'Not included · exceeds the 1 MB text budget' : 'Excluded from analysis'}</small></div>
    ${['sample', 'text'].includes(file.kind) ? `<button type="button" class="text-button" data-action="toggle-file" data-id="${file.id}">${file.included ? 'Exclude' : 'Include'}</button>` : ''}<button type="button" class="text-button" data-action="remove-file" data-id="${file.id}" aria-label="Remove ${escape(file.name)}">Remove</button></div>`).join('');
}
function errorPanel() {
  const setupError = error === 'setup';
  return `<section class="notice error" role="alert"><h2>${setupError ? 'The selected Codex setup is unavailable.' : 'The sample analysis stopped before a result was ready.'}</h2><p>${setupError ? 'Your description and files are still here. Analysis has not started.' : 'Your inputs are still here. Retry starts a new attempt.'}${draft.reports.length ? ' The previous report is still available.' : ''}</p><button class="secondary" data-action="${setupError ? 'setup' : 'retry'}">${setupError ? 'Review setup' : 'Retry analysis'}</button>${draft.reports.length ? '<button class="text-button" data-action="show-report">View previous report</button>' : ''}<details class="disclosure"><summary>Details</summary><p>Simulated ${setupError ? 'CONFIGURATION_UNAVAILABLE' : 'PROCESS_FAILED'}. No real setup was inspected and no model was called.</p></details></section>`;
}
function progress() {
  const steps = ['Check selected setup', 'Prepare isolated code', 'Investigate the problem'];
  return `<div class="page-heading"><div><p class="eyebrow">${draft.reports.length ? 'REVISING THE ANALYSIS' : 'INVESTIGATION IN PROGRESS'}</p><h1>${phase < 2 ? 'Getting everything ready' : 'Following the evidence'}</h1><p>This is a simulated run. No code or files are being read.</p></div></div><section class="card" aria-label="Investigation progress"><h2>${escape(title())}</h2><ol class="progress-list">${steps.map((step, i) => `<li class="${i < phase ? 'done' : i === phase ? 'current' : ''}" ${i === phase ? 'aria-current="step"' : ''}><span class="step-icon" aria-hidden="true">${i < phase ? '✓' : i === phase ? '' : i + 1}</span>${step}</li>`).join('')}</ol>${fieldSummary()}<div class="submit-row"><p>${phase < 2 ? 'Preparing the selected inputs.' : 'The sample result will appear here.'} You can cancel at any time.</p><button class="secondary" data-action="cancel">Cancel investigation</button></div>${draft.reports.length ? '<p class="muted">Your previous report will remain available if this revision fails.</p>' : ''}</section>`;
}
function report() {
  const current = draft.reports[selectedVersion];
  const revised = selectedVersion > 0;
  return `<div class="page-heading"><div><p class="eyebrow">INVESTIGATION READY</p><h1>The extra cent, explained.</h1><p>Review the evidence, then decide what to investigate next.</p></div></div>
    ${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}${error ? errorPanel() : ''}
    <div class="report-top"><label for="version">Report <select id="version">${draft.reports.map((_, i) => `<option value="${i}" ${i === selectedVersion ? 'selected' : ''}>Version ${i + 1}${i === draft.reports.length - 1 ? ' · Latest' : ''}</option>`).join('')}</select></label><button class="secondary" data-action="export">Export Markdown</button></div>
    <article class="card" aria-label="Investigation report"><div class="report-section"><span class="tag">SAMPLE REPORT · NOT AI-GENERATED</span><p>This fixed pricing example demonstrates the interface. It is not an analysis of your description, repository or files.</p></div>
      <section class="report-section"><h2>${revised ? 'Round the final cent amount once.' : 'Rounding moved to whole currency units.'}</h2><p>The sample pricing refactor rounds the discounted amount in whole currency units, then converts back to cents. A 1999-cent item at 15% off becomes 1700 cents instead of 1699 cents.</p>${revised ? '<p>The revised example makes the correction explicit: keep the calculation in cents and round only the final amount. No fix has been applied.</p>' : ''}</section>
      <section class="report-section"><h3>Evidence</h3><button class="evidence-button" data-action="evidence" data-kind="code"><span aria-hidden="true">01</span><div>Pricing calculation<small>src/price.js · sample source comparison</small></div></button><button class="evidence-button" data-action="evidence" data-kind="commit"><span aria-hidden="true">02</span><div>The calculation changed in the refactor<small>a81c2d9 · sample historical change</small></div></button>${current.sampleLog ? '<button class="evidence-button" data-action="evidence" data-kind="log"><span aria-hidden="true">03</span><div>The incident reproduces the extra cent<small>incident.log · included sample attachment</small></div></button>' : ''}</section>
      <section class="report-section"><h3>What is still unknown</h3><p>The sample does not establish how many orders were affected. Check other prices and discount combinations before choosing a correction.</p></section>
      ${current.feedback ? `<section class="report-section"><h3>Your revision request</h3><p>${escape(current.feedback)}</p><small>Shown to demonstrate revision history. The sample revision is predefined.</small></section>` : ''}
      <details class="disclosure"><summary>Inputs for this sample version</summary><p>${escape(current.description)}</p><p>Repository: ${escape(current.repository)}<br>Setup: ${escape(setups[current.setup].name)}<br>Model settings: ${escape(current.model === 'default' ? 'Codex defaults' : 'Saved medium profile')}</p><p>Included file names: ${escape(current.files.join(', ') || 'None')}</p><small>Local file contents were not read. Reloading the page clears preview history.</small></details>
    </article>
    ${selectedVersion === draft.reports.length - 1 ? `<form id="revision" class="card revision" aria-label="Revise analysis"><label for="feedback">What should we reconsider?</label><textarea id="feedback" required maxlength="8192" placeholder="Point out missing evidence or ask us to revisit a conclusion…">${escape(draft.feedback)}</textarea><div class="submit-row"><p>A real revision starts a new analysis and keeps the previous report. This preview simulates it.</p><button class="primary" type="submit">Revise analysis</button></div></form>` : '<p class="notice revision">You are viewing an earlier version. Select the latest version to request a revision.</p>'}`;
}
function openModal(html) {
  modalOpener = document.activeElement;
  modal.innerHTML = html;
  modal.showModal();
}
function modalHeading(title) { return `<div class="modal-heading"><h2 id="modal-title">${title}</h2><button aria-label="Close dialog" data-action="close">×</button></div>`; }
function chooseSetup(startAfter = false) {
  if (draft.reports.length) {
    openModal(`${modalHeading('Keep this investigation’s history')}<p>Changing the setup starts a new investigation with a copy of your inputs. Existing sample reports keep their recorded setup.</p><div class="modal-actions"><button class="secondary" data-action="close">Back</button><button class="primary" data-action="copy-draft">Create new draft</button></div>`); return;
  }
  launchAfterSetup = startAfter;
  openModal(`${modalHeading('Choose your Codex setup')}<p>These are sample setups. Choose deliberately; a directory name does not verify account identity. No real account will be used.</p><form id="setup-form"><fieldset><legend>Use this setup for the project</legend>${Object.entries(setups).map(([key, setup]) => `<label class="setup-option"><input type="radio" name="setup" value="${key}" required ${draft.setup === key ? 'checked' : ''}><span>${escape(setup.name)}<small>${escape(setup.path)}</small><small>Sample directory · not checked on your machine</small></span></label>`).join('')}</fieldset><div class="modal-actions"><button type="button" class="secondary" data-action="close">Cancel</button><button type="submit" class="primary">${startAfter ? 'Use setup & investigate' : 'Use this setup'}</button></div></form>`);
}
function begin() {
  if (running) return;
  if (!draft.repository.trim() || !draft.description.trim()) { screen = 'draft'; render(); document.querySelector(!draft.repository.trim() ? '#repository' : '#description').focus(); return; }
  if (!draft.setup) { chooseSetup(true); return; }
  if (new TextEncoder().encode(draft.description).length + draft.files.filter(f => f.included).reduce((sum, f) => sum + f.size, 0) > limit) {
    notice = 'The selected text exceeds the 1 MB budget. Exclude a file before continuing; nothing will be silently trimmed.'; screen = 'draft'; render(); return;
  }
  const attempt = ++epoch, outcome = scenario;
  scenario = 'success'; document.querySelector('#scenario').value = 'success';
  running = true; phase = 0; notice = ''; error = ''; screen = 'progress'; render(); announce('Preparing the sample investigation.');
  document.querySelectorAll('[data-action="new"], [data-action="home"], [data-action="settings"], [data-action="reset"], #scenario').forEach(button => { button.disabled = true; });
  function step() {
    if (attempt !== epoch || !running) return;
    if ((outcome === 'setup-error' && phase === 0) || (outcome === 'run-error' && phase === 2)) {
      finish(); error = outcome === 'setup-error' ? 'setup' : 'run'; screen = draft.reports.length ? 'report' : 'draft'; render(); announce('The sample attempt needs attention. Your inputs are preserved.'); return;
    }
    if (phase < 2) { phase++; render(false); announce(phase === 1 ? 'Preparing isolated code.' : 'Investigating the sample problem.'); timer = setTimeout(step, 1800); return; }
    finish();
    draft.reports.push({ description: draft.description, repository: draft.repository, setup: draft.setup, model: draft.model,
      files: draft.files.filter(f => f.included).map(f => f.name), sampleLog: draft.files.some(f => f.kind === 'sample' && f.included), feedback: draft.reports.length ? draft.feedback : '' });
    if (!cases.includes(draft)) cases.push(draft);
    draft.feedback = ''; selectedVersion = draft.reports.length - 1; screen = 'report'; render(); announce('Sample report ready.');
  }
  timer = setTimeout(step, 1200);
}
function finish() {
  running = false; clearTimeout(timer);
  document.querySelectorAll('[data-action="new"], [data-action="home"], [data-action="settings"], [data-action="reset"], #scenario').forEach(button => { button.disabled = false; });
}
function addFiles(files) {
  for (const file of files) {
    const text = /\.(txt|log|md|csv|json|ya?ml)$/i.test(file.name) || file.type.startsWith('text/');
    const kind = !text ? 'unsupported' : file.size > limit ? 'large' : 'text';
    draft.files.push({ id: ++nextId, name: file.name, size: file.size, kind, included: kind === 'text' && file.size > 0 });
  }
  document.querySelector('#attachments').innerHTML = attachments();
  announce('File names added to the preview. Contents were not read. Review their inclusion labels.');
}
function addLog() {
  if (!draft.files.some(f => f.kind === 'sample')) draft.files.push({ id: ++nextId, name: 'incident.log', size: sampleLog.length, kind: 'sample', included: true });
}
function settings() {
  openModal(`${modalHeading('Settings')}<p>Preview settings illustrate the separation between AI access and application storage.</p><h3>Codex setup</h3><p>${draft.setup ? `${escape(setups[draft.setup].name)}<br><code>${escape(setups[draft.setup].path)}</code>` : 'No setup selected yet.'}</p><button class="secondary" data-action="settings-setup">${draft.reports.length ? 'Start a new investigation to change setup' : 'Choose setup'}</button><h3 class="revision">Application data</h3><p>The real app manages its own data directory separately. This preview has no durable storage; reloading clears its session.</p><div class="modal-actions"><button class="primary" data-action="close">Done</button></div>`);
}
document.addEventListener('input', event => {
  if (event.target.id === 'repository') draft.repository = event.target.value;
  if (event.target.id === 'description') draft.description = event.target.value;
  if (event.target.id === 'feedback') draft.feedback = event.target.value;
});
document.addEventListener('change', event => {
  if (event.target.id === 'model') { draft.model = event.target.value; render(false); }
  if (event.target.id === 'scenario') scenario = event.target.value;
  if (event.target.id === 'files') addFiles(Array.from(event.target.files));
  if (event.target.id === 'version') { selectedVersion = Number(event.target.value); render(false); document.querySelector('#version').focus(); }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'composer' || event.target.id === 'revision') { begin(); return; }
  if (event.target.id === 'setup-form') {
    draft.setup = new FormData(event.target).get('setup');
    modal.close(); error = ''; notice = 'Sample setup selected. No real configuration was changed.';
    render(); if (launchAfterSetup) begin();
  }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (running && !['cancel', 'close'].includes(action)) return;
  if (action === 'close') { modal.close(); return; }
  if (action === 'setup') { chooseSetup(); return; }
  if (action === 'settings') { settings(); return; }
  if (action === 'settings-setup') {
    modal.close();
    if (draft.reports.length) { draft = newDraft(draft.repository, draft.setup); screen = 'draft'; notice = ''; error = ''; render(); }
    chooseSetup(); return;
  }
  if (action === 'browse') { document.querySelector('#files').click(); return; }
  if (action === 'sample-log') { addLog(); document.querySelector('#attachments').innerHTML = attachments(); announce('Sample incident log included.'); return; }
  if (action === 'sample') {
    if ((draft.description || draft.files.length) && !confirm('Replace this preview draft with the sample issue?')) return;
    draft.repository = '/home/demo/projects/checkout-service'; draft.description = sampleDescription; draft.files = []; addLog(); notice = ''; error = ''; render(); return;
  }
  if (action === 'remove-file' || action === 'toggle-file') {
    const id = Number(button.dataset.id);
    if (action === 'remove-file') draft.files = draft.files.filter(f => f.id !== id);
    else { const file = draft.files.find(f => f.id === id); file.included = !file.included; }
    document.querySelector('#attachments').innerHTML = attachments();
    document.querySelector('[data-action="sample-log"]').focus(); announce('Attachment selection updated.'); return;
  }
  if (action === 'cancel') {
    ++epoch; finish(); screen = draft.reports.length ? 'report' : 'draft'; notice = 'Investigation cancelled. Your inputs are still here.'; render(); announce(notice); return;
  }
  if (action === 'retry') { begin(); return; }
  if (action === 'new') {
    rememberDraft();
    draft = newDraft(draft.repository, draft.setup); selectedVersion = 0; screen = 'draft'; notice = ''; error = ''; render(); return;
  }
  if (action === 'copy-draft') {
    const previous = draft; draft = newDraft(previous.repository); draft.description = previous.description;
    draft.files = previous.files.map(file => ({ ...file })); draft.model = previous.model;
    selectedVersion = 0; screen = 'draft'; notice = 'Inputs copied into a new preview draft. Previous reports are unchanged.'; error = ''; modal.close(); render(); chooseSetup(); return;
  }
  if (action === 'reset') { if (confirm('Clear all preview inputs, selections and sample reports?')) window.location.reload(); return; }
  if (action === 'open-case') { rememberDraft(); draft = cases.find(item => item.id === Number(button.dataset.id)); selectedVersion = Math.max(0, draft.reports.length - 1); screen = draft.reports.length ? 'report' : 'draft'; notice = ''; error = ''; render(); return; }
  if (action === 'home' || action === 'show-report') { screen = draft.reports.length ? 'report' : 'draft'; render(); return; }
  if (action === 'evidence') {
    const evidence = button.dataset.kind === 'code' ? ['Pricing calculation', 'Sample source: src/price.js\n\nBefore:\nreturn Math.round(priceCents * (1 - discount));\n\nAfter the refactor:\nreturn Math.round((priceCents / 100) * (1 - discount)) * 100;'] : button.dataset.kind === 'commit' ? ['Historical change', 'Sample commit: a81c2d9\nSubject: Refactor display-price calculation\n\nThe example moves rounding into the currency-unit calculation.\nA later documentation-only commit leaves this calculation unchanged.'] : ['Incident log', sampleLog];
    openModal(`${modalHeading(evidence[0])}<p>Sample evidence. No repository or local file was read.</p><pre>${escape(evidence[1])}</pre><div class="modal-actions"><button class="primary" data-action="close">Back to report</button></div>`); return;
  }
  if (action === 'export') {
    const record = draft.reports[selectedVersion];
    const text = `# Sample investigation — version ${selectedVersion + 1}\n\nInteractive prototype output. Not AI-generated and not an analysis of your inputs.\n\n## Conclusion\n\nThe sample refactor rounds whole currency units before converting back to cents. A 1999-cent item at 15% off becomes 1700 cents instead of 1699 cents.\n\n## Evidence\n\nSynthetic src/price.js comparison and sample commit a81c2d9.${record.sampleLog ? ' The included sample incident.log records the difference.' : ''}\n\n## Uncertainty\n\nThe number of affected orders is unknown.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); const link = document.createElement('a'); link.href = url; link.download = `sample-investigation-v${selectedVersion + 1}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Sample Markdown report downloaded.');
  }
});
modal.addEventListener('close', () => { if (modalOpener?.isConnected) modalOpener.focus(); else content.focus(); });
document.addEventListener('dragover', event => { if (event.target.closest('#drop-zone')) { event.preventDefault(); event.target.closest('#drop-zone').classList.add('dragging'); } });
document.addEventListener('dragleave', event => { event.target.closest('#drop-zone')?.classList.remove('dragging'); });
document.addEventListener('drop', event => {
  const zone = event.target.closest('#drop-zone'); if (!zone) return;
  event.preventDefault(); zone.classList.remove('dragging'); addFiles(Array.from(event.dataTransfer.files));
});
render(false);
