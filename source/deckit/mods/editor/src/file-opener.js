const { nameOf } = require('./path.js');

// Opening a file into its workspace. A path already being opened is waited for, not read again, so two requests at once
// are one tab. A preview takes the place of its workspace's preview that has no unsaved changes; any other file opens
// after the current one.
function fileOpener({
    ui,
    deck,
    fileSystem,
    workspaces,
    disk,
    drafts,
    session,
    createView,
    scrollEffect,
    onShow,
    onChange,
}) {
    const opening = new Map(); // path -> the open under way

    return { open, tryOpen, openAt, keep };

    // A file that is not text goes to the system's app only when opened, not when a click in the tree previews it.
    async function open(path, { background = false, preview = false, preserveFocus = false } = {}) {
        const result = await tryOpen(path, { background, preview, preserveFocus });
        if (result.file) return result.file;
        if (result.passedBy) return null;
        if (result.error.kind === 'NOT_TEXT') {
            if (!background && !preserveFocus) deck.open(deck.fileURL(path));
        } else
            ui.dialog({
                title: `Could not open ${nameOf(path)}`,
                message: result.error.message,
                confirmLabel: 'OK',
            });
        return null;
    }

    // The request number is taken before any waiting.
    async function tryOpen(path, options = {}) {
        const request = options.background ? 0 : workspaces.request();
        while (opening.has(path)) await opening.get(path).catch(() => {});
        const underWay = openNow(path, { ...options, request });
        opening.set(path, underWay);
        try {
            return await underWay;
        } finally {
            if (opening.get(path) === underWay) opening.delete(path);
        }
    }

    async function openAt(path, { line, column = 0, length = 0 }) {
        const file = await open(path, { preview: true });
        if (!file || !line) return;
        const { doc } = file.view.state;
        const target = doc.line(Math.min(Math.max(1, line), doc.lines));
        const from = Math.min(target.from + column, target.to);
        file.view.dispatch({ selection: { anchor: from, head: Math.min(from + length, target.to) } });
        file.view.dispatch({ effects: scrollEffect(file.view, file.view.state.selection.main) });
        file.view.focus();
    }

    function keep(file) {
        if (!file.preview) return;
        file.preview = false;
        onChange();
    }

    // Opens end out of order, since a file not open yet is read first. One that something was requested after does
    // not come forward: a preview is passed by, and a kept file opens behind as its tab.
    async function openNow(path, { background = false, preview = false, preserveFocus = false, request = 0 } = {}) {
        const isBehind = () => !background && request !== workspaces.latestRequest();
        const opened = workspaces.fileAt(path);
        if (opened) {
            if (!preview) opened.preview = false;
            if (!background && !isBehind()) onShow(opened, { preserveFocus });
            else onChange();
            return { file: opened };
        }
        let onDisk;
        try {
            onDisk = await fileSystem.read(path);
        } catch (error) {
            if (preview && isBehind()) return { passedBy: true };
            return { error };
        }
        if (preview && isBehind()) return { passedBy: true };
        const { box, view } = createView(onDisk.text, path);
        const file = disk.admit({ path, box, view, preview }, onDisk, drafts.get(path));
        if (disk.isDirty(file)) file.preview = false;
        const workspace = place(file);
        session.reopened(workspace, path);
        if (background || isBehind()) {
            workspaces.fillIdleFront(workspace, file);
            onChange();
            session.save();
        } else onShow(file, { preserveFocus });
        return { file };
    }

    // The workspace is chosen only now, so a folder opened during the read is the one it goes to.
    function place(file) {
        const holder = workspaces.holderOf(file.path);
        const replaced =
            file.preview && holder ? holder.files.find((other) => other.preview && !disk.isDirty(other)) : null;
        const index = replaced
            ? holder.files.indexOf(replaced)
            : holder?.current
              ? holder.files.indexOf(holder.current) + 1
              : null;
        const workspace = workspaces.place(file, index);
        if (replaced) {
            if (workspace.current === replaced) workspace.current = file;
            workspaces.release(replaced);
        }
        return workspace;
    }
}

module.exports = { fileOpener };
