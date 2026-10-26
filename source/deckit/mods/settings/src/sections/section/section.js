// The rules of a section and of the cards in its body. main.js adopts them once.
const SECTION_STYLE = `
    .settings-section { margin-bottom: 22px; }
    .settings-section-head { display: flex; align-items: center; gap: 8px; min-height: 24px; padding: 0 0 6px; }
    .settings-section-title {
        flex: 1 1 auto;
        font: 700 11.5px var(--deckit-font);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.45;
    }
    .settings-section-description {
        padding: 0 0 8px;
        font: 12.5px var(--deckit-font);
        line-height: 1.5;
        opacity: 0.45;
    }
    .settings-card {
        margin-bottom: 10px;
        padding: 8px 0 4px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-medium);
    }
    .settings-card-title { padding: 0 12px 4px; font: 600 var(--deckit-type-body); }
`;

// A titled part of the Settings view. The caller adds to `head`, after the title, and fills `body`.
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
