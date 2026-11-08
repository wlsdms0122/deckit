// The rules of a list of mods in turn, each a row: the mods that open a scheme's addresses, and an interface's
// providers. main.js adopts them once.
const HANDLER_LIST_STYLE = `
    .settings-handler {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        margin: 0 4px;
        padding: 0 8px 0 28px;
        border-radius: var(--deckit-radius-control);
        cursor: default;
    }
    .settings-handler-position {
        flex: 0 0 16px;
        font: var(--deckit-type-small);
        font-variant-numeric: tabular-nums;
        text-align: right;
        opacity: 0.4;
    }
    .settings-handler-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--deckit-type-body);
    }
    .settings-handler[data-muted] .settings-handler-name { opacity: 0.55; }
`;

// A line of such a list: its position, its name, then `trailing`.
function handlerRow({ ui, trailing }) {
    const element = ui.element('div', { className: 'settings-handler' });
    const position = ui.element('span', { className: 'settings-handler-position' });
    const name = ui.element('span', { className: 'settings-handler-name' });

    element.append(position, name, ...[trailing].flat());
    return { element, set };

    function set({ position: text, label, muted }) {
        position.textContent = text;
        name.textContent = name.title = label;
        element.toggleAttribute('data-muted', muted);
    }
}

module.exports = { HANDLER_LIST_STYLE, handlerRow };
