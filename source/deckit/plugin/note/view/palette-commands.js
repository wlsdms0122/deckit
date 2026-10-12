// What the command palette offers: a new note, a search of every note, and each folder.
function paletteCommands({ ui, host, main, allNotes, onNewNote, onOpenNote, onShowFolder }) {
    const SHOWN_LIMIT = 50;

    return [
        {
            label: 'New Note',
            icon: ui.iconOf(COMPOSE_SHAPES, { size: 16 }),
            keywords: ['새 노트', '새 메모', '노트', '메모', 'new', 'note', 'memo'],
            run: () => onNewNote(),
        },
        {
            label: 'Search Notes',
            icon: ui.icon('search', { size: 16 }),
            keywords: ['노트 검색', '메모 검색', '노트', '메모', 'find', 'notes'],
            page: { placeholder: 'Search notes', search: searchEntries },
        },
        ...foldersIn(allNotes).map((folder) => ({
            group: 'Folders',
            label: folder.name,
            hint: folder.path === folder.name ? '' : parentOf(folder.path),
            icon: ui.icon('folder', { size: 16 }),
            keywords: ['노트', '폴더', 'note', 'folder'],
            run: () => {
                host.show();
                onShowFolder(folder.path);
            },
        })),
    ];

    // What a search finds, or with nothing typed, the notes edited last.
    async function searchEntries(query) {
        const words = String(query || '').trim();
        const found = words
            ? await main.call('search', words).catch(() => ({ hits: [], partial: false }))
            : { hits: notesIn(allNotes).sort((one, other) => other.mtime - one.mtime), partial: false };
        const shown = found.hits.slice(0, SHOWN_LIMIT);
        const notice =
            found.partial || found.hits.length > shown.length
                ? [
                      {
                          label: 'Only some matches are shown',
                          hint: 'Add a word to narrow it down',
                          icon: ui.icon('search', { size: 16 }),
                      },
                  ]
                : [];
        return [
            ...shown.map((note) => ({
                label: note.name || 'Untitled',
                hint: [shortDate(note.mtime), parentOf(note.path), (note.snippet || '').slice(0, 70)]
                    .filter(Boolean)
                    .join(' · '),
                icon: ui.icon('fileText', { size: 16 }),
                run: () => {
                    host.show();
                    onOpenNote(note.path);
                },
            })),
            ...notice,
        ];
    }
}
