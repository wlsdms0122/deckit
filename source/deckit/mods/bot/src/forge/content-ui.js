const { styled } = require('../dom.js');
let installed = false;
const installContent = (ui) => {
    if (installed) return;
    installed = true;
    ui.addStyle(`
    .bot-content { width: 100%; max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; padding-bottom: 24px; }
    .bot-content h2, .bot-content h3 { margin: 0; overflow-wrap: anywhere; }
    .bot-content h2 { font: 700 20px var(--deckit-font); }
    .bot-content h3 { font: 600 13px var(--deckit-font); color: var(--deckit-muted); }
    .bot-content section { display: flex; flex-direction: column; gap: 14px; }
    .bot-content .deckit-select { width: 100%; max-width: none; }
    .bot-content .bot-label { display: flex; flex-direction: column; gap: 6px; font: 600 12px var(--deckit-font); }
    .bot-content [aria-label='Days of week'] button[aria-pressed='true'] { background: var(--deckit-accent); color: var(--deckit-on-accent); }
    .bot-content input, .bot-content textarea { font-weight: 400; }
    .bot-detail { display: flex; flex-direction: column; gap: 28px; }
    .bot-intro { display: flex; flex-direction: column; gap: 8px; }
    .bot-content > [data-catalog-status] { border-top: var(--deckit-border); padding-top: 16px; }
    .bot-content section > .deckit-text-button { align-self: flex-start; }
    .bot-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .bot-values { display: grid; grid-template-columns: minmax(90px, 1fr) minmax(0, 3fr); gap: 10px 16px; margin: 0; font: 12px var(--deckit-font); }
    .bot-values dt { color: var(--deckit-muted); } .bot-values dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
    .bot-feedback:empty { display: none; } .bot-feedback { padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px var(--deckit-font); }
    .bot-field-error { color: var(--deckit-alert); font: 12px var(--deckit-font); } .bot-field-error:empty { display: none; }
    .bot-content [aria-invalid='true'] { outline: 1px solid var(--deckit-alert); outline-offset: 2px; }
  `);
};
const muted = (text) =>
    styled(
        'div',
        {
            color: 'var(--deckit-muted)',
            font: '12px var(--deckit-font)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
        },
        text
    );
const actions = () => {
    const node = styled('div');
    node.className = 'bot-actions';
    return node;
};
const section = (title, ...nodes) => {
    const node = styled('section');
    node.append(styled('h3', {}, title), ...nodes);
    return node;
};
const values = (items) => {
    const node = styled('dl');
    node.className = 'bot-values';
    for (const [key, value] of Object.entries(items))
        node.append(
            styled('dt', {}, key),
            styled('dd', {}, typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—'))
        );
    return node;
};
const feedback = (node, message, error = false) => {
    node.className = 'bot-feedback';
    node.textContent = message;
    node.setAttribute('role', error ? 'alert' : 'status');
    const color = error ? 'var(--deckit-alert)' : 'var(--deckit-ok)';
    Object.assign(node.style, { color, background: `color-mix(in srgb, ${color} 10%, transparent)` });
};
module.exports = { installContent, muted, actions, section, values, feedback };
