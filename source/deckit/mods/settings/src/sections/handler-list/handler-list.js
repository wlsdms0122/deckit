// The rules of a list of mods asked in turn, each a row dragged into its place and switched on or off: a scheme's
// handlers, an interface's implementations. main.js adopts them once.
const HANDLER_LIST_STYLE = `
    .settings-handler {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        margin: 0 4px;
        padding: 0 8px 0 6px;
        border-radius: var(--deckit-radius-control);
        cursor: default;
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .settings-handler[data-draggable] { cursor: grab; }
    .settings-handler[data-draggable]:hover { background: var(--deckit-hover); }
    .settings-handler-grip { display: flex; flex: 0 0 14px; opacity: 0.35; }
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

// A line of such a list: a grip when it can be dragged, its position, its name, then `trailing`.
function handlerRow({ ui, trailing, draggable = false }) {
    const element = ui.element('div', { className: 'settings-handler' });
    const grip = ui.element('span', { className: 'settings-handler-grip' });
    const position = ui.element('span', { className: 'settings-handler-position' });
    const name = ui.element('span', { className: 'settings-handler-name' });

    element.toggleAttribute('data-draggable', draggable);
    if (draggable) grip.innerHTML = ui.icon('grip', { size: 14 });
    element.append(grip, position, name, ...[trailing].flat());
    return { element, set };

    function set({ position: text, label, muted }) {
        position.textContent = text;
        name.textContent = name.title = label;
        element.toggleAttribute('data-muted', muted);
    }
}

// `list` with `id` the key of its rows, moved from where `id` is to where `toId` is: answers the list as it is then,
// with what placing the moved row sets (`placing`), or null when either is not in it.
function moved(list, id, toId) {
    const next = [...list];
    const from = next.findIndex((item) => item.id === id);
    const to = next.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return null;
    next.splice(to, 0, next.splice(from, 1)[0]);
    return { list: next, ...placing(next, id) };
}

// What placing the row `id` of `list` sets, `{ order, off }` as the list's setter takes them: the rows down to it
// and including it are placed as shown, and those of them not on are switched off. The rows after it are left as
// they are.
function placing(list, id) {
    const placed = list.slice(0, list.findIndex((item) => item.id === id) + 1);
    return {
        order: placed.map((item) => item.id),
        off: placed.filter((item) => !item.on).map((item) => item.id),
    };
}

module.exports = { HANDLER_LIST_STYLE, handlerRow, moved, placing };
