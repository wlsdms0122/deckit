// A folder's folders and notes as cards, or the notes a search found. `shownFolder()` is the folder on screen, or null
// while a note is.
function gallery({
    ui,
    host,
    main,
    settings,
    relocations,
    navigation,
    shownFolder,
    allNotes,
    noteMenu,
    folderMenu,
    describeDrag,
    acceptDrops,
    onOpenNote,
    onOpenFolder,
    onNewNote,
    onNewFolder,
}) {
    const SEARCH_DELAY_MS = 150;
    const STYLE = `
        .note-search { flex: 0 1 220px; min-width: 140px; }
        .note-gallery {
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding: 6px 24px 28px;
            outline: none;
        }
        .note-gallery-heading { margin: 16px 2px 8px; color: var(--deckit-muted); font: 700 var(--deckit-type-small); }
        .note-gallery-status { padding: 24px 4px; color: var(--deckit-muted); }
        .note-gallery-partial { padding: 14px 4px; color: var(--deckit-muted); font: var(--deckit-type-small); }
        .note-gallery-empty { position: absolute; inset: 0; }
        .note-gallery-empty[hidden] { display: none; }
        .note-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .note-card {
            box-sizing: border-box;
            min-width: 0;
            padding: 12px 14px;
            border-radius: var(--deckit-radius-large);
            background: var(--deckit-fill);
            cursor: default;
            transition: background-color var(--deckit-fast) var(--deckit-easing);
        }
        .note-card:hover { background: var(--deckit-hover); }
        .note-card-note { display: flex; flex-direction: column; gap: 6px; height: 156px; }
        .note-card-folder { display: flex; align-items: center; gap: 10px; height: 62px; }
        .note-card-title, .note-card-text { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
        .note-card-title { -webkit-line-clamp: 2; line-height: 1.3; font: 700 13.5px var(--deckit-font); }
        .note-card-text {
            flex: 1 1 auto;
            -webkit-line-clamp: 4;
            line-height: 1.45;
            color: var(--deckit-muted);
            font: 12.5px var(--deckit-font);
        }
        .note-card-footer {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--deckit-muted);
            font: 11.5px var(--deckit-font);
        }
        .note-card-icon { display: flex; flex: 0 0 auto; }
        .note-card-words { flex: 1 1 auto; min-width: 0; }
        .note-card-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: 600 13.5px var(--deckit-font);
        }
        .note-card-contents { margin-top: 2px; white-space: nowrap; color: var(--deckit-muted); font: var(--deckit-type-small); }
    `;

    // The notes of a folder as main listed them, with the relocation count they were asked at.
    let listing = { folder: null, notes: [], since: 0 };
    let query = '';
    let queryHits = null;
    let partial = false;
    let searches = 0;
    let loads = 0;

    ui.addStyle(STYLE);
    const element = ui.element('div', { className: 'note-pane' });
    const field = ui.field({
        placeholder: 'Search all notes',
        size: 'small',
        icon: ui.icon('search', { size: 13 }),
        clearable: true,
        onInput: (value) => search(value),
        onSubmit: () => {
            if (queryHits?.length) onOpenNote(queryHits[0].path);
        },
        onCancel: () => {
            field.set('');
            search('');
        },
    });
    const newFolderButton = ui.iconButton({
        icon: ui.icon('folderPlus', { size: 16 }),
        title: 'New folder',
        onClick: () => onNewFolder(),
        size: 'small',
    });
    const newNoteButton = ui.iconButton({
        icon: ui.iconOf(COMPOSE_SHAPES, { size: 16 }),
        title: 'New note',
        onClick: () => onNewNote(),
        size: 'small',
    });
    const body = ui.element('div', { className: 'note-gallery' });
    const resultHeading = ui.element('div', { className: 'note-gallery-heading' });
    const folderHeading = ui.element('div', { className: 'note-gallery-heading', text: 'Folders' });
    const folderCards = ui.list({ key: (item) => item.path, create: folderCardOf });
    const noteHeading = ui.element('div', { className: 'note-gallery-heading', text: 'Notes' });
    const noteCards = ui.list({ key: (item) => item.path, create: noteCardOf });
    const status = ui.element('div', { className: 'note-gallery-status' });
    const partialNotice = ui.element('div', {
        className: 'note-gallery-partial',
        text: 'Only some of the matches are shown. Add a word to narrow it down.',
    });
    const newNoteAction = ui.button({
        label: 'New Note',
        title: 'New note',
        onClick: () => onNewNote(),
        size: 'small',
        icon: ui.iconOf(COMPOSE_SHAPES, { size: 14 }),
    });
    const newFolderAction = ui.button({
        label: 'New Folder',
        title: 'New folder',
        onClick: () => onNewFolder(),
        size: 'small',
        icon: ui.icon('folderPlus', { size: 14 }),
    });
    const empty = ui.emptyState({
        icon: ui.iconOf(NOTEBOOK_SHAPES, { size: 44 }),
        actions: [newNoteAction.element, newFolderAction.element],
    });

    field.element.classList.add('note-search');
    folderCards.element.classList.add('note-grid');
    noteCards.element.classList.add('note-grid');
    empty.element.classList.add('note-gallery-empty');
    body.tabIndex = 0;
    body.append(
        resultHeading,
        folderHeading,
        folderCards.element,
        noteHeading,
        noteCards.element,
        status,
        partialNotice,
        empty.element
    );
    element.append(navigation.element, body);
    navigation.trailing.append(field.element, newFolderButton.element, newNoteButton.element);
    for (const [button, text, action] of [
        [newFolderButton.element, 'New folder', 'newFolder'],
        [newNoteButton.element, 'New note', 'newNote'],
        [newNoteAction.element, 'New note', 'newNote'],
        [newFolderAction.element, 'New folder', 'newFolder'],
    ])
        ui.tooltip(button, { text, chord: () => host.chordOf(action) });
    for (const button of [newFolderButton.element, newNoteButton.element])
        button.addEventListener('mousedown', (event) => event.preventDefault());
    ui.edgeFade(body);
    // Delegated, so a card drawn again never loses a press.
    body.addEventListener('click', (event) => {
        const card = entryAt(event.target);
        if (!card) return;
        const { kind, path } = entryOf(card);
        if (kind === 'note') onOpenNote(path);
        else onOpenFolder(path);
    });
    ui.contextMenu(body, {
        rowAt: entryAt,
        items: (card) => {
            if (!card) return folderMenu(shownFolder());
            const { kind, path, since } = entryOf(card);
            return kind === 'note' ? noteMenu(path, since) : folderMenu(path, since, card);
        },
    });
    // From each list, which holds its cards while one is dragged.
    for (const cards of [folderCards, noteCards])
        ui.dragSource(cards.element, { itemAt: entryAt, describe: describeDrag });
    acceptDrops(body, (under) => {
        const card = entryAt(under);
        const entry = card && entryOf(card);
        return entry?.kind === 'folder'
            ? { folder: entry.path, mark: card, since: entry.since }
            : { folder: shownFolder(), mark: body };
    });

    return {
        element,
        draw,
        load,
        refresh,
        arrive,
        focus: () => body.focus(),
        focusSearch: () => {
            field.input.focus();
            field.input.select();
        },
        labelOf: (path) => labelIn(body, path),
    };

    function draw() {
        const folder = shownFolder();
        if (folder == null) return;
        if (query) return drawResults();
        const node = folderAt(allNotes(), folder);
        // Until this folder's list arrives, another folder's notes are never drawn under its name.
        const isReady = !!node && listing.folder === folder;
        const folders = isReady ? node.folders : [];
        const notes = isReady ? sortedNotes(listing.notes) : [];
        resultHeading.hidden = true;
        folderHeading.hidden = !folders.length;
        folderCards.set(folders.map(folderItemOf));
        noteHeading.hidden = !notes.length;
        noteCards.set(notes.map((note) => noteItemOf(note, { since: listing.since })));
        status.textContent = 'Loading…';
        status.hidden = isReady;
        partialNotice.hidden = true;
        empty.element.hidden = !isReady || folders.length > 0 || notes.length > 0;
        empty.set({
            title: folder ? 'This folder is empty' : 'No notes yet',
            hint: folder ? '' : 'A note is a Markdown file, and a folder here is a folder on disk.',
        });
    }

    function drawResults() {
        resultHeading.textContent = queryHits ? `${queryHits.length}${partial ? '+' : ''} found` : 'Searching…';
        resultHeading.hidden = false;
        folderHeading.hidden = true;
        folderCards.set([]);
        noteHeading.hidden = true;
        noteCards.set((queryHits || []).map((hit) => noteItemOf(hit, { since: hit.since, isHit: true })));
        status.textContent = 'No notes match';
        status.hidden = !queryHits || queryHits.length > 0;
        partialNotice.hidden = !partial;
        empty.element.hidden = true;
    }

    async function load() {
        const folder = shownFolder();
        if (folder == null) return;
        const attempt = ++loads;
        const since = relocations.since();
        let notes = [];
        try {
            notes = await main.call('list', folder);
        } catch {}
        if (attempt !== loads || shownFolder() !== folder) return;
        listing = { folder, notes, since };
        draw();
    }

    // An answer to a search that was overtaken, by another search or by a folder reached, is dropped.
    function search(value) {
        query = value.trim();
        const attempt = ++searches;
        queryHits = null;
        if (!query) partial = false;
        draw();
        if (!query) return;
        setTimeout(async () => {
            if (attempt !== searches) return;
            let found = { hits: [], partial: false };
            const since = relocations.since();
            try {
                found = await main.call('search', query);
            } catch {}
            if (attempt !== searches) return;
            queryHits = found.hits.map((hit) => ({ ...hit, since }));
            partial = found.partial;
            draw();
        }, SEARCH_DELAY_MS);
    }

    function refresh() {
        const loaded = load();
        if (query) search(query);
        return loaded;
    }

    // On a folder reached: the search gives way to it, and a folder other than the last one starts at the top.
    function arrive({ isNewFolder }) {
        if (query) {
            field.set('');
            query = '';
            queryHits = null;
            partial = false;
            searches++;
        }
        if (isNewFolder) body.scrollTop = 0;
    }

    function sortedNotes(notes) {
        const order = settings.get('sort');
        if (order === 'name')
            return [...notes].sort((one, other) =>
                one.name.localeCompare(other.name, undefined, { numeric: true, sensitivity: 'base' })
            );
        return [...notes].sort((one, other) =>
            order === 'created' ? (other.birth || other.mtime) - (one.birth || one.mtime) : other.mtime - one.mtime
        );
    }

    function folderItemOf(folder) {
        const notes = folder.count;
        const folders = folder.folders.length;
        return {
            kind: 'folder',
            path: folder.path,
            since: allNotes().since,
            name: folder.name,
            contents:
                [
                    notes ? `${notes} note${notes === 1 ? '' : 's'}` : '',
                    folders ? `${folders} folder${folders === 1 ? '' : 's'}` : '',
                ]
                    .filter(Boolean)
                    .join(' · ') || 'Empty',
        };
    }

    // A hit shows the words it was found by and the folder it is in.
    function noteItemOf(note, { since, isHit = false }) {
        const time = settings.get('sort') === 'created' ? note.birth || note.mtime : note.mtime;
        return {
            kind: 'note',
            path: note.path,
            since,
            title: note.name || 'Untitled',
            text: (isHit ? note.snippet : note.preview) || 'No additional text',
            footer: [shortDate(time), isHit ? parentOf(note.path) : ''].filter(Boolean).join(' · '),
        };
    }

    function folderCardOf(item) {
        const card = ui.element('div', { className: 'note-card note-card-folder' });
        const icon = ui.element('span', { className: 'note-card-icon' });
        const words = ui.element('div', { className: 'note-card-words' });
        const name = ui.element('div', { className: 'note-card-name', text: item.name });
        markEntry(card, item);
        icon.innerHTML = ui.folderIcon({ open: false, size: 26 });
        // What a drag carries and an inline rename types over.
        name.dataset.name = '';
        words.append(name, ui.element('div', { className: 'note-card-contents', text: item.contents }));
        card.append(icon, words);
        return card;
    }

    function noteCardOf(item) {
        const card = ui.element('div', { className: 'note-card note-card-note' });
        const title = ui.element('div', { className: 'note-card-title', text: item.title });
        markEntry(card, item);
        title.dataset.name = '';
        card.append(
            title,
            ui.element('div', { className: 'note-card-text', text: item.text }),
            ui.element('div', { className: 'note-card-footer', text: item.footer })
        );
        return card;
    }
}
