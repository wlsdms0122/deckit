const { styled } = require('../dom.js');
const { fieldsOf } = require('./workflow-inputs.js');
const { workflowTree } = require('./workflow-tree.js');
const { workflowForm } = require('./workflow-form.js');
const { listDivider } = require('./list-divider.js');
const { installContent, actions, section, values, feedback } = require('./content-ui.js');

const workflowsView = ({ deck, bot, reveal }) => {
const { ui } = deck; installContent(ui);
let form = null, runButton = null;
const store = deck.storage.values;
let session = store.get('workflow-session', store.get('session', 'default')) || 'default';
let visible = false, epoch = 0, timer = null, refreshing = null, detailRequest = 0;
let catalog = [], selected = null, spec = null, busy = false, available = false;
const drafts = new Map();
const call = (name, operation, args) => bot.forge.supervisor.call(name, `workflow.${operation}`, args);
const muted = (text) => styled('div', { color: 'var(--deckit-muted)', font: '12px var(--deckit-font)' }, text);
const status = muted('');
const notice = styled('div'); feedback(notice, '');
const bar = styled('div', { display: 'none', flex: '1', minWidth: '0', alignItems: 'center', gap: '8px' });
const sessionBar = ui.segmented({ items: [], value: session, size: 'small', onChange: chooseSession });
const search = ui.field({ placeholder: 'Search workflows', icon: ui.icon('search', { size: 14 }), onInput: paintCatalog });
const refreshButton = ui.iconButton({ icon: ui.icon('reload', { size: 15 }), title: 'Refresh workflows', onClick: () => { refresh(); if (selected) choose(selected); } });
bar.append(sessionBar.element, search.element, refreshButton.element);
const pane = styled('div', { display: 'none', flex: '1', minHeight: '0', minWidth: '0', borderTop: 'var(--deckit-border)' });
const listPane = styled('div', { overflow: 'auto', padding: '8px', borderRight: 'var(--deckit-border)' });
const divider = listDivider({ ui, theme: deck.theme, store, pane, list: listPane, key: 'workflow-list-width' });
const content = styled('div', { flex: '1', minWidth: '0', overflow: 'auto', padding: '24px' });
const runs = styled('div');
const detail = styled('div'); detail.className = 'forge-detail';
status.setAttribute('data-catalog-status', '');
const page = styled('div'); page.className = 'forge-content'; page.append(notice, detail, runs, status); content.append(page);
pane.append(listPane, divider, content);
ui.edgeFade(listPane); ui.edgeFade(content);
const parts = new WeakMap();
const paintRow = (element, entry) => {
const row = parts.get(element);
element.querySelector('[data-name]').textContent = entry.folder ? `${entry.name} · ${entry.count}` : entry.item.name;
element.title = entry.folder || `${entry.item.description || ''}\n${entry.item.source || ''}`;
row.setOpen(!!entry.open); row.setActive(!entry.folder && entry.item.name === selected);
};
const list = ui.list({
key: (entry) => entry.key + ':' + entry.depth,
create: (entry) => {
const row = ui.treeRow({ depth: entry.depth, folder: !!entry.folder, open: entry.open, name: '', glyph: ui.icon('list', { size: 14 }) });
row.element.addEventListener('click', () => {
if (!entry.folder) return choose(entry.item.name);
if (search.input.value.trim()) return;
const all = store.get('workflow-folds', {}), folded = new Set(all[session] || []);
if (folded.has(entry.folder)) folded.delete(entry.folder); else folded.add(entry.folder);
store.set('workflow-folds', { ...all, [session]: [...folded] }); paintCatalog();
});
parts.set(row.element, row); paintRow(row.element, entry); return row.element;
}, update: paintRow,
});
const empty = muted('');
listPane.append(list.element, empty);

function paintCatalog() {
const rows = workflowTree(catalog, { query: search.input.value, folded: store.get('workflow-folds', {})[session] || [] });
list.set(rows);
empty.textContent = rows.length ? '' : catalog.length ? 'No matching workflows' : 'No workflows';
}
function chooseSession(name) {
session = name; store.set('workflow-session', session); epoch++; detailRequest++;
sessionBar.set(session); status.textContent = 'Loading workflows…'; status.title = '';
catalog = []; selected = null; spec = null; available = false; feedback(notice, ''); runList.set([]);
paintCatalog(); paintDetail(); clearTimeout(timer); refresh();
}
async function choose(name) {
selected = name; spec = null; const request = ++detailRequest, owner = session;
paintCatalog(); paintDetail();
try {
const described = await call(owner, 'describe', { name });
if (request !== detailRequest || owner !== session) return;
spec = described; paintDetail();
} catch (error) {
if (request === detailRequest && owner === session) feedback(notice, error.message, true);
}
}
function paintDetail() {
detail.replaceChildren(); form = null; runButton = null;
if (!selected) { detail.append(muted('Choose a workflow to see its inputs and run it.')); return; }
const header = styled('header', { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' });
header.append(styled('h2', {}, selected));
const intro = styled('div'); intro.className = 'forge-intro'; intro.append(header); detail.append(intro);
if (!spec) { detail.append(muted('Loading workflow…')); return; }
if (spec.description) intro.append(muted(spec.description));
const name = selected, owner = session, key = `${owner}:${name}`;
if (!drafts.has(key)) drafts.set(key, {});
form = workflowForm({ ui, fields: fieldsOf(spec), draft: drafts.get(key) });
runButton = ui.button({ label: 'Run workflow', icon: ui.icon('play', { size: 14 }), variant: 'primary', onClick: () => {
const inputs = form.read(); if (inputs === null) return;
act(owner, async () => {
const result = await call(owner, 'dispatch', { name, inputs }); return `Dispatched ${name} · ${result.workflow_id}`;
});
} });
const controls = actions(); controls.append(runButton.element); header.append(controls);
detail.append(section('Inputs', form.element), section('Definition', values({ Source: spec.source || '—', Outputs: Object.keys(spec.outputs || {}).join(', ') || 'None' })));
updateBusy();
}
const runParts = new WeakMap();
const runList = ui.list({ key: (run) => run.workflow_id,
create: (run) => {
const row = styled('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' });
const text = styled('div', { flex: '1', minWidth: '0', overflowWrap: 'anywhere' }), state = muted('');
const cancel = ui.button({ label: 'Cancel', size: 'small', onClick: () => {
const run = runParts.get(row).run, owner = session;
act(owner, async () => { await call(owner, 'cancel', { id: run.workflow_id }); return `Cancellation requested · ${run.workflow_id}`; });
} });
row.append(text, state, cancel.element); runParts.set(row, { text, state, cancel }); paintRun(row, run); return row;
}, update: paintRun,
});
function paintRun(row, run) {
const part = runParts.get(row); part.run = run; part.text.textContent = run.workflow_name;
part.text.title = run.workflow_id; part.state.textContent = run.state;
part.state.style.color = run.state === 'running' ? 'var(--deckit-ok)' : 'var(--deckit-warn)';
part.cancel.setEnabled(!busy && available && run.state !== 'cancelling');
}
const runEmpty = muted(''); runs.append(section('Active workflows', runList.element, runEmpty));
function paintRuns(payload) {
runList.set(payload.workflows || []); runEmpty.textContent = payload.workflows?.length ? '' : 'No queued or running workflows.';
}
function updateBusy() {
runButton?.setEnabled(!busy && available); runButton?.setLabel(busy ? 'Working…' : 'Run workflow'); form?.setBusy(busy);
for (const row of runList.element.children) { const part = runParts.get(row); if (part?.run) part.cancel.setEnabled(!busy && available && part.run.state !== 'cancelling'); }
}
async function act(owner, action) {
if (busy) return; busy = true; updateBusy(); feedback(notice, '');
try { const message = await action(); if (owner === session) feedback(notice, message); }
catch (error) { if (owner === session) { form?.showError(error.message); feedback(notice, error.message, true); } }
finally { busy = false; updateBusy(); if (owner === session) { epoch++; refreshing = null; } refresh(); }
}
async function refresh() {
if (!visible || refreshing?.epoch === epoch) return;
clearTimeout(timer);
const request = { epoch, session }; refreshing = request;
const current = () => visible && request.epoch === epoch && request.session === session;
try {
const sessions = await bot.forge.supervisor.sessions();
if (!current()) return;
sessionBar.setItems(sessions.sessions.map((item) => ({ key: item.name, label: item.name, title: item.up ? 'Running' : 'Stopped' })));
sessionBar.set(session);
const chosen = sessions.sessions.find((item) => item.name === session);
if (!chosen?.up || !chosen.authority) throw new Error(!chosen?.up ? 'Daemon stopped. Start it in Services.' : 'No token for this daemon. Manage its authority in Services.');
const [listing, active] = await Promise.all([call(session, 'list'), call(session, 'active')]);
if (!current()) return;
const wasAvailable = available; available = true;
catalog = listing.workflows || [];
status.textContent = `${catalog.length} workflows · ${active.free_slots ?? '—'} free slots`;
if (listing.failures?.length) status.textContent += ` · ${listing.failures.length} definitions could not load`;
status.title = (listing.failures || []).map((failure) => `${failure.path}: ${failure.reason}`).join('\n');
if (selected && !catalog.some((item) => item.name === selected)) { selected = null; spec = null; detailRequest++; paintDetail(); }
paintCatalog(); paintRuns(active);
if (selected && !spec) choose(selected);
else if (!wasAvailable && !form) paintDetail();
updateBusy();
} catch (error) {
if (current()) { available = false; status.textContent = error.message; runList.set([]); updateBusy(); }
} finally {
if (refreshing === request) { refreshing = null; if (visible) timer = setTimeout(refresh, 3000); }
}
}
paintDetail();
return { bar, pane,
show: () => { visible = true; epoch++; refresh(); },
hide: () => { visible = false; epoch++; detailRequest++; clearTimeout(timer); },
commands: () => [{ label: 'Workflows', hint: 'Browse, run and cancel Forge workflows', icon: ui.icon('list', { size: 16 }), keywords: ['forge', 'workflow', '워크플로우'], run: reveal }],
};
};

module.exports = { workflowsView };
