// The rules of a section, of the cards in its body and of a setting's row in a card, its label and hint over each
// other before its control. main.js adopts them once.
const SECTION_STYLE = `
    .settings-section { margin-bottom: 22px; }
    .settings-section-head { display: flex; align-items: center; gap: 8px; min-height: 24px; padding: 0 0 6px; }
    .settings-section-title { flex: 1 1 auto; font: 600 var(--deckit-type-heading); }
    .settings-section-description { padding: 0 0 8px; color: var(--deckit-muted); font: var(--deckit-type-small); }
    .settings-card {
        margin-bottom: 10px;
        padding: 8px 0 4px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-medium);
    }
    .settings-card-title { padding: 0 12px 4px; font: 600 var(--deckit-type-body); }
    .settings-setting {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        min-height: 36px;
        padding: 4px 12px;
    }
    .settings-setting-words { display: flex; flex: 1 1 240px; flex-direction: column; gap: 1px; min-width: 0; }
    .settings-setting-label { font: var(--deckit-type-body); }
    .settings-setting-hint { color: var(--deckit-muted); font: var(--deckit-type-small); }
`;

// A titled part of the Settings window. The caller adds to `head`, after the title, and fills `body`.
function section({ ui, title, description = '' }) {
    const element = ui.element('div', { className: 'settings-section' });
    const head = ui.element('div', { className: 'settings-section-head' });
    const body = ui.element('div');

    head.append(ui.element('div', { className: 'settings-section-title', text: title }));
    element.append(head);
    if (description)
        element.append(ui.element('div', { className: 'settings-section-description', text: description }));
    element.append(body);
    return { element, head, body };
}

module.exports = { SECTION_STYLE, section };
