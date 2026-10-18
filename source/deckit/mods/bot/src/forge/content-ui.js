const { styled } = require('../dom.js');
let installed = false;
const installContent = (ui) => {
if (installed) return; installed = true;
ui.addStyle(`
    .forge-content { width: 100%; max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; padding-bottom: 24px; }
    .forge-content h2, .forge-content h3 { margin: 0; overflow-wrap: anywhere; }
    .forge-content h2 { font: 700 20px var(--deckit-font); }
    .forge-content h3 { font: 600 13px var(--deckit-font); color: var(--deckit-muted); }
    .forge-content section { display: flex; flex-direction: column; gap: 14px; }
    .forge-content .deckit-select { width: 100%; max-width: none; }
    .forge-content .forge-label { display: flex; flex-direction: column; gap: 6px; font: 600 12px var(--deckit-font); }
    .forge-content [aria-label='Days of week'] button[aria-pressed='true'] { background: var(--deckit-accent); color: var(--deckit-on-accent); }
    .forge-content input, .forge-content textarea { font-weight: 400; }
    .forge-detail { display: flex; flex-direction: column; gap: 28px; }
    .forge-intro { display: flex; flex-direction: column; gap: 8px; }
    .forge-content > [data-catalog-status] { border-top: var(--deckit-border); padding-top: 16px; }
    .forge-content section > .deckit-text-button { align-self: flex-start; }
    .forge-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .forge-values { display: grid; grid-template-columns: minmax(90px, 1fr) minmax(0, 3fr); gap: 10px 16px; margin: 0; font: 12px var(--deckit-font); }
    .forge-values dt { color: var(--deckit-muted); } .forge-values dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
    .forge-feedback:empty { display: none; } .forge-feedback { padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px var(--deckit-font); }
    .forge-field-error { color: var(--deckit-alert); font: 12px var(--deckit-font); } .forge-field-error:empty { display: none; }
    .forge-content [aria-invalid='true'] { outline: 1px solid var(--deckit-alert); outline-offset: 2px; }
  `);
};
const muted = (text) => styled('div', { color: 'var(--deckit-muted)', font: '12px var(--deckit-font)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, text);
const actions = () => { const node = styled('div'); node.className = 'forge-actions'; return node; };
const section = (title, ...nodes) => { const node = styled('section'); node.append(styled('h3', {}, title), ...nodes); return node; };
const values = (items) => {
const node = styled('dl'); node.className = 'forge-values';
for (const [key, value] of Object.entries(items)) node.append(styled('dt', {}, key), styled('dd', {}, typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—')));
return node;
};
const feedback = (node, message, error = false) => {
node.className = 'forge-feedback'; node.textContent = message; node.setAttribute('role', error ? 'alert' : 'status');
const color = error ? 'var(--deckit-alert)' : 'var(--deckit-ok)';
Object.assign(node.style, { color, background: `color-mix(in srgb, ${color} 10%, transparent)` });
};
module.exports = { installContent, muted, actions, section, values, feedback };
