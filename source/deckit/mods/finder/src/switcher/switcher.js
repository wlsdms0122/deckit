// What Finder adds to the switcher through its point `switcher:actions`: the folders at hand, a search of them and a
// path typed, the system places, and what its keys do. Each action's value is `{ action, ...args }`, run by
// `does[action](args, { ready })`; one that opens a search is the value its results add an arg to.
// `atHand()` answers the paths of the folders at hand, `favorites` how each is drawn, `foldersAtHand(query)` those
// found for a query, and `places` are the system places, `[id, title]`.
function switcher({ ui, util, atHand, favorites, foldersAtHand, places, show, does }) {
    return { list, search, run };

    function list() {
        return [
            ...atHand().map((path) => ({
                label: favorites.labelOf(path),
                hint: util.tildify(path),
                icon: ui.icon(favorites.iconNameOf(path), { size: 16 }),
                value: { action: 'open-folder', path },
            })),
            { label: 'Open Folder', keywords: ['폴더', 'folder'], opens: true, value: { action: 'open-folder' } },
            { label: 'Go to Place', opens: true, value: { action: 'go-to-place' } },
            { label: 'Go to Folder…', key: 'goToFolder', value: { action: 'go-to-folder' } },
            { label: 'New Tab', key: 'newTab', value: { action: 'new-tab' } },
            { label: 'Close Tab', key: 'closeTab', value: { action: 'close-tab' } },
            { label: 'Reopen Closed Tab', key: 'reopenTab', value: { action: 'reopen-tab' } },
            { label: 'Back', key: 'back', value: { action: 'back' } },
            { label: 'Forward', key: 'forward', value: { action: 'forward' } },
            { label: 'Enclosing Folder', key: 'enclosing', value: { action: 'enclosing-folder' } },
            { label: 'Open', key: 'open', value: { action: 'open' } },
            { label: 'Open with Default App', key: 'openWithDefaultApp', value: { action: 'open-with-default-app' } },
            { label: 'Filter This Folder', key: 'filter', value: { action: 'filter' } },
            { label: 'Show Hidden Files', key: 'hidden', value: { action: 'toggle-hidden' } },
            { label: 'New Folder', key: 'newFolder', value: { action: 'new-folder' } },
            { label: 'View As', opens: true, value: { action: 'show-as' } },
            { label: 'Move to Trash', key: 'trash', value: { action: 'trash' } },
        ];
    }

    // Inside Open Folder the folders at hand and the path as typed, inside Go to Place the places, inside View As the
    // views.
    function search(query, within) {
        if (within?.action === 'open-folder') {
            const found = foldersAtHand(query).map(({ value, title, hint }) => ({
                label: title,
                hint,
                value: { ...within, path: value },
            }));
            const typed = query && !found.some(({ value }) => value.path === query);
            return typed
                ? [...found, { label: query, hint: 'A path from / or ~', value: { ...within, path: query } }]
                : found;
        }
        if (within?.action === 'go-to-place')
            return matching(
                places.map(([place, title]) => ({ label: title, key: place, value: { ...within, place } })),
                query
            );
        if (within?.action === 'show-as')
            return matching(
                [
                    { label: 'Columns', key: 'columnView', value: { ...within, view: 'columns' } },
                    { label: 'List', key: 'listView', value: { ...within, view: 'list' } },
                ],
                query
            );
        return [];
    }

    // An action calls `ready()` once it has found it can be done, and the mod comes to the front then, so a refusal
    // is read under the switcher's list; one whose result goes on elsewhere does not call it.
    async function run({ action, ...args }) {
        await does[action](args, { ready: show });
    }

    function matching(actions, query) {
        return actions.filter(({ label }) => !query || util.match(label, query));
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
