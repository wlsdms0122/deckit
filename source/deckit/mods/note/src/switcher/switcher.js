const { foldersIn } = require('../notes-folder/folder.js');
const { parentOf } = require('../notes-folder/path.js');

// What Notes adds to the switcher through its point `switcher:actions`: a search of every note, each folder to go to,
// what its keys do, and the paragraph styles. Each action's value is `{ action, ...args }`, run by
// `does[action](args, { ready })`; one that opens a search is the value its results add an arg to.
// `notesOf(query, { signal })` answers the notes found, and `styles` are the paragraph styles, `{ key, label }`, each
// under the key of its name.
function switcher({ ui, util, allNotes, notesOf, styles, show, does }) {
    let searching = null; // the search of notes under way, which a newer one stops
    return { list, search, run };

    function list() {
        return [
            {
                label: 'Search Notes',
                keywords: ['노트 검색', '메모 검색', '노트', '메모', 'find', 'notes'],
                opens: true,
                value: { action: 'open' },
            },
            ...foldersIn(allNotes()).map((folder) => ({
                group: 'Folders',
                label: folder.name,
                hint: parentOf(folder.path),
                icon: ui.icon('folder', { size: 16 }),
                value: { action: 'show-folder', path: folder.path },
            })),
            {
                label: 'New Note',
                key: 'newNote',
                keywords: ['새 노트', '새 메모', '노트', '메모', 'new', 'note', 'memo'],
                value: { action: 'new-note' },
            },
            { label: 'New Folder', key: 'newFolder', value: { action: 'new-folder' } },
            { label: 'Move to Trash', key: 'trash', value: { action: 'trash' } },
            { label: 'Search in Gallery', key: 'search', value: { action: 'search' } },
            { label: 'Back', key: 'back', value: { action: 'back' } },
            { label: 'Forward', key: 'forward', value: { action: 'forward' } },
            { label: 'Set Paragraph Style', opens: true, value: { action: 'paragraph-style' } },
            { label: 'Mark as Checked', key: 'markChecked', value: { action: 'mark-checked' } },
        ];
    }

    // Inside Search Notes the notes found, or null where a newer search stopped this one, inside Set Paragraph Style
    // the styles.
    async function search(query, within) {
        if (within?.action === 'paragraph-style')
            return styles
                .filter(({ label }) => !query || util.match(label, query))
                .map(({ key, label }) => ({ label, key, value: { ...within, style: key } }));
        if (within?.action !== 'open') return [];
        searching?.abort();
        const asking = (searching = new AbortController());
        const found = await notesOf(query, { signal: asking.signal });
        return (
            found && found.map(({ value, title, hint }) => ({ label: title, hint, value: { ...within, id: value } }))
        );
    }

    // An action calls `ready()` once it has found it can be done, and the mod comes to the front then, so a refusal
    // is read under the switcher's list; one whose result goes on elsewhere does not call it.
    async function run({ action, ...args }) {
        await does[action](args, { ready: show });
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
