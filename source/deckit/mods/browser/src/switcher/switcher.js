const { parseAddress, isWrittenAddress, placeOf } = require('../address/address.js');
const { candidatesOf } = require('../candidates/candidates.js');
const { tabLabel } = require('../tabs/tab-list.js');

// What the Browser adds to the switcher through its `setActions(actions)`: what its keys do, the closed tab Reopen
// Closed Tab would bring back, a search of the tabs and of the bookmarks, and an address typed there. Each action's
// value is `{ action, ...args }`, run by `does[action](args, { ready })`; one that opens a search is the value its
// results add an arg to.
function switcher({ ui, util, tabs, bookmarks, show, does }) {
    return { list, search, run };

    function list() {
        const icon = ui.icon('window', { size: 16 });
        const lastClosed = tabs.lastClosed();
        return [
            {
                label: 'New Tab',
                icon,
                keywords: ['웹', '웹페이지', '열기', '주소', '새탭', 'url', 'open', 'web', 'address', 'new tab'],
                value: { action: 'new-tab' },
            },
            ...(lastClosed
                ? [
                      {
                          label: 'Reopen Closed Tab',
                          hint: lastClosed.title || placeOf(lastClosed.url),
                          icon,
                          keywords: ['닫은탭', '다시열기', '복구', 'reopen', 'undo', 'closed tab'],
                          value: { action: 'reopen-tab' },
                      },
                  ]
                : []),
            { label: 'Switch to Tab', keywords: ['탭', 'tabs'], opens: true, value: { action: 'switch-to-tab' } },
            {
                label: 'Open Bookmark',
                keywords: ['북마크', '즐겨찾기', 'bookmarks'],
                opens: true,
                value: { action: 'open-bookmark' },
            },
            { label: 'Close Tab', value: { action: 'close-tab' } },
            { label: 'Find in Page', value: { action: 'find-in-page' } },
            { label: 'Edit Address', value: { action: 'edit-address' } },
            { label: 'Reload', value: { action: 'reload' } },
            { label: 'Back', value: { action: 'back' } },
            { label: 'Forward', value: { action: 'forward' } },
        ];
    }

    // Inside Switch to Tab the tabs, inside Open Bookmark the bookmarks. Outside, only an address is found: a search
    // for any words would put an action above the ranked list on every keystroke. One written with its scheme or as
    // a path goes on top; a host guessed from a bare name ("README.md") goes below what matches it, so a file or a
    // note of that name comes first.
    function search(query, within) {
        if (within?.action === 'switch-to-tab')
            return candidatesOf(tabs.tree(), tabLabel, query, util).map((found) => actionOf(found, within, 'tab'));
        if (within?.action === 'open-bookmark')
            return candidatesOf(bookmarks.tree(), (each) => each.title || placeOf(each.url), query, util).map((found) =>
                actionOf(found, within, 'bookmark')
            );
        const url = parseAddress(query);
        if (within || !url) return [];
        return [
            {
                fallback: !isWrittenAddress(query),
                label: 'Open ' + placeOf(url),
                hint: 'In a new tab',
                icon: ui.icon('window', { size: 16 }),
                value: { action: 'new-tab', url },
            },
        ];
    }

    // An action calls `ready()` once it has found it can be done, and the mod comes to the front then, so a refusal
    // is read under the switcher's list; one whose result goes on elsewhere does not call it.
    async function run({ action, ...args }) {
        await does[action](args, { ready: show });
    }

    function actionOf({ value, title, hint, keywords }, within, arg) {
        return { label: title, hint, keywords, value: { ...within, [arg]: value } };
    }
}

// The actions of `does` done with the mod in front, each ready once its synchronous part, where a refusal throws,
// is past.
function inFront(does) {
    return Object.fromEntries(
        Object.entries(does).map(([name, run]) => [
            name,
            (args, { ready }) => {
                const doing = run(args);
                ready();
                return doing;
            },
        ])
    );
}

module.exports = { switcher, inFront };
