const { parseAddress, isWrittenAddress, placeOf } = require('../address/address.js');

// What the Browser adds to the switcher's own list of its commands, through the point `switcher:rows`: the tab
// commands drawn with a tab's icon, the closed tab Reopen Closed Tab would bring back, and an address typed there.
function switcher({ ui, lastClosedTab }) {
    return { rows, resolve };

    function rows() {
        const icon = ui.icon('window', { size: 16 });
        const lastClosed = lastClosedTab();
        return [
            { label: 'New Tab', icon, run: { command: 'new-tab' } },
            ...(lastClosed
                ? [
                      {
                          label: 'Reopen Closed Tab',
                          hint: lastClosed.title || placeOf(lastClosed.url),
                          icon,
                          run: { command: 'reopen-tab' },
                      },
                  ]
                : []),
        ];
    }

    // Only an address resolves: a search for any words would put a row above the ranked list on every keystroke. One
    // written with its scheme or as a path goes on top; a host guessed from a bare name ("README.md") goes below what
    // matches it, so a file or a note of that name comes first.
    function resolve(query) {
        const url = parseAddress(query);
        if (!url) return [];
        return [
            {
                fallback: !isWrittenAddress(query),
                label: 'Open ' + placeOf(url),
                hint: 'In a new tab',
                icon: ui.icon('window', { size: 16 }),
                run: { command: 'new-tab', args: { url } },
            },
        ];
    }
}

module.exports = { switcher };
