const { nameOf } = require('../path/path.js');

// What is done to an open file: save it, save it elsewhere, reload it, keep it over a change on disk, close it, with
// the questions these ask the person.
function fileActions({ ui, fileSystem, disk, workspaces, drafts, onOpen, onDrop }) {
    return { save, saveAll, saveElsewhere, saveCopy, pick, reload, keepMine, close, drop, checkOpenFile };

    async function save(file, force = false) {
        if (!file || (!disk.isDirty(file) && !force)) return true;
        try {
            await disk.save(file, { force });
            return true;
        } catch (error) {
            if (error.kind === 'CHANGED')
                ui.dialog({
                    title: `${nameOf(file.path)} changed on disk`,
                    message:
                        'Another program wrote to it after it was opened here. Saving now replaces that with what is here.',
                    confirmLabel: 'Save anyway',
                    cancelLabel: 'Cancel',
                    extraLabel: 'Reload from disk',
                    onExtra: () => reload(file, true),
                    destructive: true,
                    onConfirm: () => save(file, true),
                });
            else
                ui.dialog({
                    title: `Could not save ${nameOf(file.path)}`,
                    message: error.message,
                    confirmLabel: 'OK',
                });
            return false;
        }
    }

    async function saveAll(files) {
        for (const file of files) if (disk.isDirty(file)) await save(file);
    }

    // What was here is in the new file then, so this one closes without asking.
    async function saveElsewhere(file) {
        const [path] = await pick('save', file.path);
        if (!path) return;
        if (path === file.path) {
            await save(file, true);
            return;
        }
        if (!(await saveCopy(path, disk.textOf(file.view.state)))) return;
        await checkOpenFile(path);
        drop(file);
        await onOpen(path);
    }

    async function saveCopy(path, text) {
        try {
            await fileSystem.write(path, text, null);
            return true;
        } catch (error) {
            ui.dialog({ title: 'Could not save', message: error.message, confirmLabel: 'OK' });
            return false;
        }
    }

    // `what` is 'file', 'folder' or 'save'. Nothing is picked when the system's panel could not be shown.
    async function pick(what, suggested) {
        try {
            return await fileSystem.pick(what, suggested);
        } catch {
            return [];
        }
    }

    // A file gone is marked so by disk.check, and the notice then offers what is left.
    async function reload(file, force = false) {
        if (!file) return false;
        try {
            return await disk.reload(file, { force });
        } catch (error) {
            if (error.kind === 'GONE') {
                await disk.check(file).catch(() => false);
                return false;
            }
            ui.dialog({
                title: `Could not reload ${nameOf(file.path)}`,
                message: error.message,
                confirmLabel: 'OK',
            });
            return false;
        }
    }

    async function keepMine(file) {
        if (!file) return;
        try {
            await disk.keepMine(file);
        } catch (error) {
            ui.dialog({ title: `Could not read ${nameOf(file.path)}`, message: error.message, confirmLabel: 'OK' });
        }
    }

    function close(file) {
        if (!file) return;
        if (!disk.isDirty(file)) return drop(file);
        ui.dialog({
            title: `Save changes to ${nameOf(file.path)}?`,
            message: 'Closing without saving loses them.',
            confirmLabel: 'Save',
            cancelLabel: 'Cancel',
            extraLabel: "Don't save",
            onExtra: () => drop(file),
            onConfirm: async () => {
                if (await save(file)) drop(file);
            },
        });
    }

    // Closes without asking. Closing is the answer to "save changes?", so whatever was not saved is let go, and it
    // counts as a request for what is left. The keyboard moves on only if it was in the file or nowhere: a file
    // trashed from the tree leaves it in the tree, for the next ⌘⌫.
    function drop(file) {
        const focused = document.activeElement;
        const follow = file.view.hasFocus || !focused || focused === document.body;
        const inFront = workspaces.current() === file;
        if (!workspaces.release(file)) return;
        if (inFront) workspaces.bringToFront(workspaces.front(), workspaces.front()?.current ?? null);
        drafts.forget(file.path);
        onDrop();
        if (follow) workspaces.current()?.view.focus();
    }

    async function checkOpenFile(path) {
        const file = workspaces.fileAt(path);
        if (file) await disk.check(file).catch(() => false);
    }
}

module.exports = { fileActions };
