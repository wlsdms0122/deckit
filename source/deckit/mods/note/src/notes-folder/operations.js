const { nameOf, parentOf, noteNameOf, isWithin } = require('./path.js');

// What is done to a note or a folder on disk. A path is held as it was read with the relocation count it was read at
// (`since`). A step that moves, renames or removes what may be the open note settles the open note first, so what
// changes is what was on screen. `onChanged()` hears that the notes folder changed. A step that fails says so in a
// failure toast, whose Try Again takes the step again: the tree has no line of its own to hold it.
function operations({
    ui,
    clipboard,
    reveal,
    notesFolder,
    relocations,
    settle,
    enqueue,
    openPath,
    isBlank,
    openText,
    onRelocate,
    onTrash,
    onNoteMade,
    onFocusTitle,
    onChanged,
    labelFor,
}) {
    let rootAsked = null;

    return { rename, move, trashNote, trashFolder, newNote, newFolder, copyText, showInFolder };

    // Over `label`, in place.
    function rename(label, held, since = relocations.since()) {
        return ui.inlineEdit(label, {
            onCommit: async (name) => {
                const path = await relocations.currentPath(held, since);
                if (path == null) return 'It is no longer there';
                if (!(await settle(path))) return 'The open note has a question to answer first';
                let refusal = '';
                await enqueue(async () => {
                    try {
                        onRelocate(path, (await notesFolder.rename(path, name)).path);
                    } catch (error) {
                        refusal = error.message;
                    }
                });
                await onChanged();
                return refusal;
            },
        });
    }

    async function move(held, heldInto, since = relocations.since(), intoSince = since) {
        const path = await relocations.currentPath(held, since);
        const into = await relocations.currentPath(heldInto, intoSince);
        if (path == null || into == null) return;
        // Checked again: something may have moved since it was picked up.
        if (!ui.movesInto(path, into)) return;
        if (!(await settle(path))) return;
        await enqueue(async () => {
            try {
                onRelocate(path, (await notesFolder.move(path, into)).path);
            } catch (error) {
                failed('Could not move ' + nameOf(path), error, () => move(path, into));
            }
        });
        await onChanged();
    }

    function trashNote(held, since = relocations.since()) {
        return trash(held, since, (path) => `Could not move ${noteNameOf(path)} to the Trash`);
    }

    function trashFolder(held, since = relocations.since()) {
        ui.confirmTrash({
            name: nameOf(held),
            onConfirm: () => trash(held, since, () => 'Could not move the folder to the Trash'),
        });
    }

    async function newNote(into) {
        if (!(await settle())) return;
        // Another would discard this blank one and take the next free name on every press.
        if (isBlank() && parentOf(openPath()) === into) return onFocusTitle();
        let made;
        try {
            made = await notesFolder.create(into);
        } catch (error) {
            failed('Could not make a note', error, () => newNote(into));
            return;
        }
        await onNoteMade(made.path);
    }

    async function newFolder(parent) {
        let made;
        try {
            made = await notesFolder.mkdir(parent, '');
        } catch (error) {
            failed('Could not make the folder', error, () => newFolder(parent));
            return;
        }
        await onChanged();
        const label = await labelFor(made.path);
        if (label) rename(label, made.path);
    }

    async function copyText(path) {
        const copied = path === openPath() ? openText() : (await notesFolder.read(path).catch(() => null))?.text;
        if (copied != null) clipboard.writeText(copied).catch(() => {});
    }

    async function showInFolder(path) {
        rootAsked ||= notesFolder
            .root()
            .then((answer) => answer.root)
            .catch(() => null);
        const root = await rootAsked;
        if (root) reveal(path ? root + '/' + path : root);
    }

    function failed(title, error, retry) {
        ui.toast(`${title}: ${error.message}`, { kind: 'failure', action: { label: 'Try Again', run: retry } });
    }

    // Saved first, so what goes to the Trash is what was on screen.
    async function trash(held, since, failureTitle) {
        const path = await relocations.currentPath(held, since);
        if (path == null) return;
        const wasOpen = !!openPath() && isWithin(openPath(), path);
        if (!(await settle(path))) return;
        try {
            await enqueue(async () => {
                await notesFolder.trash(path);
                onRelocate(path, null);
            });
        } catch (error) {
            failed(failureTitle(path), error, () => trash(path, relocations.since(), failureTitle));
            return;
        }
        await onTrash(path, wasOpen);
        await onChanged();
    }
}

module.exports = { operations };
