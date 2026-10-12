// What is done to a note or a folder on disk. A path is held as it was read with the relocation count it was read at
// (`since`), and each step settles the open note first, so what moves is what was on screen.
function operations({
    ui,
    host,
    main,
    noteSession,
    relocations,
    onRelocate,
    onTrash,
    refresh,
    paintPlace,
    loadTree,
    labelFor,
    openNote,
}) {
    let rootAsked = null;

    return { rename, move, trashNote, trashFolder, newNote, newFolder, copyText, showInFinder };

    // Over `label`, in place.
    function rename(label, held, since = relocations.count()) {
        return ui.inlineEdit(label, {
            onCommit: async (name) => {
                const path = await relocations.currentPath(held, since);
                if (path == null) return 'It is no longer there';
                if (!(await noteSession.settle(path))) return 'The open note has a question to answer first';
                let refusal = '';
                await noteSession.enqueue(async () => {
                    try {
                        onRelocate(path, (await main.call('rename', path, name)).rel);
                    } catch (error) {
                        refusal = error.message;
                    }
                });
                await refresh();
                noteSession.paint();
                return refusal;
            },
        });
    }

    async function move(held, heldInto, since = relocations.count(), intoSince = since) {
        const path = await relocations.currentPath(held, since);
        const into = await relocations.currentPath(heldInto, intoSince);
        if (path == null || into == null) return;
        // Checked again: something may have moved since it was picked up.
        if (!ui.movesInto(path, into)) return;
        if (!(await noteSession.settle(path))) return;
        await noteSession.enqueue(async () => {
            try {
                onRelocate(path, (await main.call('move', path, into)).rel);
            } catch (error) {
                ui.dialog({ title: 'Could not move ' + baseName(path), message: error.message, confirmLabel: 'OK' });
            }
        });
        await refresh();
        noteSession.paint();
        paintPlace();
    }

    function trashNote(held, since = relocations.count()) {
        return trash(held, since, (path) => `Could not move ${noteName(path)} to the Trash`);
    }

    function trashFolder(held, since = relocations.count()) {
        ui.confirmTrash({
            name: baseName(held),
            onConfirm: () => trash(held, since, () => 'Could not move the folder to the Trash'),
        });
    }

    async function newNote(into) {
        host.show();
        if (!(await noteSession.settle())) return;
        // Another would discard this blank one and take the next free name on every press.
        if (noteSession.isBlank() && parentOf(noteSession.path()) === into) return noteSession.focusTitle();
        let made;
        try {
            made = await main.call('create', into);
        } catch (error) {
            ui.dialog({ title: 'Could not make a note', message: error.message, confirmLabel: 'OK' });
            return;
        }
        if (!(await openNote(made.rel))) return;
        noteSession.markPristine();
        await refresh();
        noteSession.focusTitle();
    }

    async function newFolder(parent) {
        let made;
        try {
            made = await main.call('mkdir', parent, '');
        } catch (error) {
            ui.dialog({ title: 'Could not make the folder', message: error.message, confirmLabel: 'OK' });
            return;
        }
        await loadTree();
        const label = await labelFor(made.rel);
        if (label) rename(label, made.rel);
    }

    async function copyText(path) {
        const text =
            path === noteSession.path() ? noteSession.text() : (await main.call('read', path).catch(() => null))?.text;
        if (text != null) host.clipboard.writeText(text).catch(() => {});
    }

    async function showInFinder(path) {
        rootAsked ||= main
            .call('root')
            .then((answer) => answer.root)
            .catch(() => null);
        const root = await rootAsked;
        if (root) host.reveal(path ? root + '/' + path : root);
    }

    // Saved first, so what goes to the Trash is what was on screen.
    async function trash(held, since, failureTitle) {
        const path = await relocations.currentPath(held, since);
        if (path == null) return;
        const wasOpen = !!noteSession.path() && isWithin(noteSession.path(), path);
        if (!(await noteSession.settle(path))) return;
        try {
            await noteSession.enqueue(() => main.call('trash', path));
        } catch (error) {
            ui.dialog({ title: failureTitle(path), message: error.message, confirmLabel: 'OK' });
            return;
        }
        onRelocate(path, null);
        await onTrash(path, wasOpen);
        await refresh();
    }
}
