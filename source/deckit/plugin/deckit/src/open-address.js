// An address typed with its scheme, handed to deck to open: its scheme's handlers in the person's order, then the
// system's answer. Offered only when one of them is there, and named after the one asked first.
function openAddress({ ui, urlSchemes, open }) {
    const ADDRESS = /^([a-z][a-z0-9+.-]*):\S+$/i;
    const SYSTEM_OPENERS = { browser: 'In the default browser', file: 'In its default app' };

    return { entriesFor };

    function entriesFor(query) {
        const address = query.trim();
        const scheme = ADDRESS.exec(address)?.[1].toLowerCase();
        const opener = scheme ? openerOf(scheme) : null;
        if (!opener) return [];
        return [
            {
                label: 'Open ' + address,
                hint: opener,
                icon: ui.icon('link', { size: 16 }),
                run: () => open(address),
            },
        ];
    }

    // A scheme with no list of its own is offered to the plugins that take every scheme.
    function openerOf(scheme) {
        const lists = urlSchemes.list();
        const list =
            lists.find((entry) => entry.scheme === scheme) ||
            lists.find((entry) => entry.scheme === urlSchemes.everyScheme);
        const first = list?.handlers.find((handler) => handler.on);
        if (first) return 'With ' + first.name;
        return SYSTEM_OPENERS[list?.system] || null;
    }
}

module.exports = { openAddress };
