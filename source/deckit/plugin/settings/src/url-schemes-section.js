const { chip } = require('./chip.js');
const { NO_VALUE, schemeName } = require('./format.js');
const { section } = require('./section.js');

// The URL Schemes section: a card per scheme with its handler list, the plugins asked in turn to open an address,
// reordered by dragging and switched off one by one, and the host app's own answer after them.
function urlSchemesSection({ ui, urlSchemes, appName }) {
    const TITLE = 'URL Schemes';
    const KEYWORDS = [
        '열기',
        '링크',
        '파일 열기',
        '다음으로 열기',
        '스킴',
        'url scheme',
        'open with',
        'open link',
        'open file',
    ];
    const DESCRIPTION =
        'Addresses by their scheme, and the plugins that open them. Plugins are asked in order, ' +
        'and one may pass; drag to change the order, switch one off to skip it. When every plugin ' +
        `passes, ${appName} opens it the default way, for a scheme it has one for.`;
    const DEFAULT_ANSWERS = {
        browser: 'Opens in the system browser',
        file: "Opens in the system's app when you asked for it, otherwise shows it in Finder",
    };
    const everyScheme = urlSchemes.everyScheme;

    const cardFills = new WeakMap(); // card -> its fill(handlerList)
    const rowFills = new WeakMap(); // handler row -> its fill(entry)

    ui.addStyle(`
        .settings-scheme-name { padding: 0 12px; font: 600 var(--deckit-type-body); }
        .settings-scheme-description { padding: 1px 12px 6px; font: var(--deckit-type-small); opacity: 0.5; }
        .settings-scheme-none { padding: 4px 12px 6px 44px; font: 12.5px var(--deckit-font); opacity: 0.4; }
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
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const cards = ui.list({
        key: (handlerList) => handlerList.scheme,
        create: schemeCard,
        update: (card, handlerList) => cardFills.get(card)(handlerList),
    });

    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    function draw() {
        cards.set(urlSchemes.list());
    }

    function schemeCard(handlerList) {
        let current = handlerList;

        const card = ui.element('div', { className: 'settings-card' });
        const none = ui.element('div', { className: 'settings-scheme-none', text: 'No plugin takes this over.' });
        const list = ui.list({
            key: ({ handler }) => handler.id,
            create: handlerEntry,
            update: (row, entry) => rowFills.get(row)(entry),
        });
        const defaultChip = chip({ ui, text: 'Default', muted: true });
        const defaultRow = handlerRow({ trailing: defaultChip.element });

        card.append(
            ui.element('div', { className: 'settings-scheme-name', text: schemeName(handlerList.scheme, everyScheme) }),
            ui.element('div', {
                className: 'settings-scheme-description',
                text: schemeDescription(handlerList.scheme),
            }),
            none,
            list.element,
            defaultRow.element
        );
        ui.sortable(list, {
            onReorder: (id, toId) => {
                const next = [...current.handlers];
                const from = next.findIndex((handler) => handler.id === id);
                const to = next.findIndex((handler) => handler.id === toId);
                if (from < 0 || to < 0) return;
                next.splice(to, 0, next.splice(from, 1)[0]);
                save(current.scheme, next);
                draw();
            },
        });
        cardFills.set(card, fill);
        fill(handlerList);
        return card;

        function fill(handlerList) {
            current = handlerList;
            const defaultAnswer = DEFAULT_ANSWERS[handlerList.system];
            list.set(handlerList.handlers.map((handler, index) => ({ handler, index })));
            none.hidden = handlerList.handlers.length > 0;
            defaultChip.element.hidden = !defaultAnswer;
            defaultRow.set({ position: NO_VALUE, label: defaultAnswer || 'Nothing opens it', muted: true });
            defaultRow.element.title = defaultAnswer
                ? `${appName}'s own answer. It is always last and cannot be switched off.`
                : `${appName} has no answer of its own here: when every plugin passes, the address is not opened.`;
        }

        function handlerEntry(entry) {
            let currentEntry = entry;

            const toggle = ui.toggle({
                value: entry.handler.on,
                onChange: (on) => {
                    const { handler } = currentEntry;
                    toggle.set(on);
                    save(
                        current.scheme,
                        current.handlers.map((candidate) =>
                            candidate.id === handler.id ? { ...handler, on } : candidate
                        )
                    );
                    draw();
                },
            });
            const row = handlerRow({ trailing: toggle.element, draggable: true });

            rowFills.set(row.element, fill);
            fill(entry);
            return row.element;

            function fill(entry) {
                currentEntry = entry;
                const { handler, index } = entry;
                toggle.set(handler.on);
                toggle.element.title = handler.on
                    ? `${handler.name} is asked ${index === 0 ? 'first' : 'in this place'}`
                    : `${handler.name} is skipped`;
                row.set({ position: String(index + 1), label: handler.name, muted: !handler.on });
            }
        }
    }

    function save(scheme, handlers) {
        urlSchemes.set(scheme, {
            order: handlers.map((handler) => handler.id),
            off: handlers.filter((handler) => !handler.on).map((handler) => handler.id),
        });
    }

    // A line of a handler list: a grip when it can be dragged, its position, its name, then `trailing`.
    function handlerRow({ trailing, draggable = false }) {
        const element = ui.element('div', { className: 'settings-handler' });
        const grip = ui.element('span', { className: 'settings-handler-grip' });
        const position = ui.element('span', { className: 'settings-handler-position' });
        const name = ui.element('span', { className: 'settings-handler-name' });

        element.toggleAttribute('data-draggable', draggable);
        if (draggable) grip.innerHTML = ui.icon('grip', { size: 14 });
        element.append(grip, position, name, trailing);
        return { element, set };

        function set({ position: text, label, muted }) {
            position.textContent = text;
            name.textContent = name.title = label;
            element.toggleAttribute('data-muted', muted);
        }
    }

    function schemeDescription(scheme) {
        if (scheme === everyScheme) return 'An address no scheme above names, for the plugins that take every scheme.';
        if (scheme === 'http' || scheme === 'https')
            return 'A web address: a link clicked in a plugin, or a page asking for a new window.';
        if (scheme === 'file') return 'A file on this Mac, such as a row in a file list.';
        return `An address that starts with ${scheme}:, which a plugin named.`;
    }
}

module.exports = { urlSchemesSection };
