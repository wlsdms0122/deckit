// An address typed with its scheme, handed to deck to open: its scheme's handlers in the person's order, then the
// system's answer.
function openAddress({ ui, open }) {
    const ADDRESS = /^[a-z][a-z0-9+.-]*:\S+$/i;

    return { entriesFor };

    function entriesFor(query) {
        const address = query.trim();
        if (!ADDRESS.test(address)) return [];
        return [
            {
                label: 'Open ' + address,
                hint: 'To the handlers of its scheme',
                icon: ui.icon('link', { size: 16 }),
                run: () => open(address),
            },
        ];
    }
}

module.exports = { openAddress };
