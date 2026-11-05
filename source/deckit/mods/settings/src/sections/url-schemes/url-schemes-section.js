const { chip } = require('../../chip/chip.js');
const { NO_VALUE, schemeName } = require('../../format/format.js');
const { section } = require('../section/section.js');
const { handlerRow, moved, placing } = require('../handler-list/handler-list.js');

// The URL Schemes section: a card per scheme with its handler list, the mods asked in turn to open an address,
// reordered by dragging and switched off one by one, and the host app's own answer after them. A card names its
// undecided patterns: those whose addresses go to mods no one placed by id alone.
function urlSchemesSection({ ui, urls, appName }) {
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
        'Addresses by their scheme, and the mods that open them. Mods are asked in order, ' +
        'and one may pass; drag to change the order, switch one off to skip it. When every mod ' +
        `passes, ${appName} opens it the default way, for a scheme it has one for.`;
    const DEFAULT_ANSWERS = {
        browser: 'Opens in the system browser',
        file: "Opens in the system's app when you asked for it, otherwise shows it in Finder",
    };
    const everyScheme = urls.everyScheme;

    const cardFills = new WeakMap(); // card -> its fill(handlerList)
    const rowFills = new WeakMap(); // handler row -> its fill(entry)

    ui.addStyle(`
        .settings-scheme-head { display: flex; align-items: center; gap: 8px; padding: 0 12px; }
        .settings-scheme-name { flex: 1 1 auto; min-width: 0; font: 600 var(--deckit-type-body); }
        .settings-scheme-description { padding: 1px 12px 6px; font: var(--deckit-type-small); opacity: 0.5; }
        .settings-scheme-none { padding: 4px 12px 6px 44px; font: 12.5px var(--deckit-font); opacity: 0.4; }
    `);
    const { element, body } = section({ ui, title: TITLE, description: DESCRIPTION });
    const cards = ui.list({
        key: (handlerList) => handlerList.scheme,
        create: schemeCard,
        update: (card, handlerList) => cardFills.get(card)(handlerList),
    });

    body.append(cards.element);
    return { element, title: TITLE, keywords: KEYWORDS, draw };

    function draw(handlerLists) {
        cards.set(handlerLists);
    }

    function schemeCard(handlerList) {
        let current = handlerList;

        const card = ui.element('div', { className: 'settings-card' });
        const head = ui.element('div', { className: 'settings-scheme-head' });
        const undecided = chip({ ui, text: 'Undecided' });
        const none = ui.element('div', { className: 'settings-scheme-none', text: 'No mod takes this over.' });
        const list = ui.list({
            key: ({ handler }) => handler.id,
            create: handlerEntry,
            update: (row, entry) => rowFills.get(row)(entry),
        });
        const defaultChip = chip({ ui, text: 'Default', muted: true });
        const defaultRow = handlerRow({ ui, trailing: defaultChip.element });

        undecided.element.title =
            'No one placed the mods that take these addresses, so they are asked by name for now. Drag one to the top.';
        head.append(
            ui.element('div', { className: 'settings-scheme-name', text: schemeName(handlerList.scheme, everyScheme) }),
            undecided.element
        );
        card.append(
            head,
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
                const next = moved(current.handlers, id, toId);
                if (!next) return;
                urls.set(current.scheme, next);
                draw(urls.list());
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
            undecided.element.hidden = !handlerList.undecided.length;
            undecided.element.textContent =
                'Undecided: ' +
                handlerList.undecided
                    .map((pattern) => (pattern === everyScheme ? 'every address' : pattern))
                    .join(', ');
            defaultChip.element.hidden = !defaultAnswer;
            defaultRow.set({ position: NO_VALUE, label: defaultAnswer || 'Nothing opens it', muted: true });
            defaultRow.element.title = defaultAnswer
                ? `${appName}'s own answer. It is always last and cannot be switched off.`
                : `${appName} has no answer of its own here: when every mod passes, the address is not opened.`;
        }

        function handlerEntry(entry) {
            let currentEntry = entry;

            const toggle = ui.toggle({
                value: entry.handler.on,
                onChange: (on) => {
                    const { handler } = currentEntry;
                    const next = current.handlers.map((candidate) =>
                        candidate.id === handler.id ? { ...handler, on } : candidate
                    );
                    toggle.set(on);
                    urls.set(current.scheme, placing(next, handler.id));
                    draw(urls.list());
                },
            });
            const row = handlerRow({ ui, trailing: toggle.element, draggable: true });

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

    function schemeDescription(scheme) {
        if (scheme === everyScheme) return 'An address no scheme above names, for the mods that take every scheme.';
        if (scheme === 'http' || scheme === 'https')
            return 'A web address: a link clicked in a mod, or a page asking for a new window.';
        if (scheme === 'file') return 'A file on this Mac, such as a row in a file list.';
        return `An address that starts with ${scheme}:, which a mod named.`;
    }
}

module.exports = { urlSchemesSection };
