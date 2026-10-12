// The disk side of an open file. `file.saved` is the document on disk at `file.mtime`. `file.base` is the disk version
// unsaved edits were made over; when it is not the one on disk, `file.conflict` is that disk version ({ mtime }). These,
// `file.trouble` and the line separator are set only here, and each change of them is told to `onDiskStateChange`.
function fileDisk({ engine, main, onDiskStateChange }) {
    // A compartment, so replaceText can choose it again.
    const separator = new engine.Compartment();

    return {
        textOf,
        isDirty,
        separatorExtension,
        admit,
        draftOf,
        holding,
        keepMine,
        save,
        reload,
        check,
        writeUnopened,
    };

    function textOf(state) {
        return state.sliceDoc();
    }

    function isDirty(file) {
        return !file.view.state.doc.eq(file.saved);
    }

    // CRLF only when every line break is one. Never left to the engine, which would write CR, LF and CRLF all back as
    // LF. Line n of the document stays line n of the file counted by "\n", as the search and the replace count.
    function separatorFor(text) {
        return text.includes('\r\n') && !/(^|[^\r])\n/.test(text) ? '\r\n' : '\n';
    }

    function separatorOf(text) {
        return engine.EditorState.lineSeparator.of(separatorFor(text));
    }

    function separatorExtension(text) {
        return separator.of(separatorOf(text));
    }

    function documentOf(text) {
        return engine.EditorState.create({ doc: text, extensions: separatorOf(text) }).doc;
    }

    // Split by the new separator before inserting: an inserted string is split by the old one. Kept out of undo:
    // undoing past a reload would restore text the disk no longer has, and the next save would write over the other
    // program's change.
    function replaceText(file, text) {
        const replacement = documentOf(text);
        const state = file.view.state;
        file.view.dispatch(
            state.update({
                changes: { from: 0, to: state.doc.length, insert: replacement },
                effects: separator.reconfigure(separatorOf(text)),
                selection: { anchor: Math.min(state.selection.main.head, replacement.length) },
                annotations: engine.Transaction.addToHistory.of(false),
            })
        );
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    function commit(file, saved, mtime) {
        file.saved = saved;
        file.mtime = mtime;
        file.base = mtime;
        file.conflict = null;
        file.trouble = null;
        onDiskStateChange(file);
    }

    // `mtime` is the disk version "Keep mine" is checked against.
    function conflictWith(file, mtime) {
        file.conflict = { mtime };
        onDiskStateChange(file);
        return false;
    }

    function troubleWith(file, trouble) {
        file.trouble = trouble;
        onDiskStateChange(file);
        return false;
    }

    function admit(file, onDisk, draft) {
        Object.assign(file, {
            saved: file.view.state.doc,
            mtime: onDisk.mtime,
            base: onDisk.mtime,
            conflict: null,
            trouble: null,
        });
        if (draft && draft.text !== onDisk.text) {
            replaceText(file, draft.text);
            file.base = draft.base;
            if (Math.abs(draft.base - onDisk.mtime) > 1) file.conflict = { mtime: onDisk.mtime };
        }
        return file;
    }

    function draftOf(file) {
        return { text: textOf(file.view.state), base: file.base };
    }

    // One disk operation per file at a time, so each starts from the mtime the last one left.
    function queue(file, job) {
        const next = (file.pending || Promise.resolve()).catch(() => {}).then(job);
        file.pending = next;
        return next;
    }

    // A rename or removal moves a file from under its path; a save landing in between would write to the old path.
    function holding(files, job) {
        const done = Promise.all(files.map((file) => (file.pending || Promise.resolve()).catch(() => {}))).then(job);
        for (const file of files) file.pending = done;
        return done;
    }

    // If the disk moved again since the conflict was shown, the conflict is shown again with that version.
    function keepMine(file) {
        return queue(file, async () => {
            if (!file.conflict) return true;
            const onDisk = await main.call('read', file.path);
            if (Math.abs(onDisk.mtime - file.conflict.mtime) > 1) return conflictWith(file, onDisk.mtime);
            commit(file, documentOf(onDisk.text), onDisk.mtime);
            return true;
        });
    }

    function save(file, { force = false } = {}) {
        return queue(file, async () => {
            if (file.conflict && !force) throw refusal('CHANGED', 'changed on disk since it was opened');
            const state = file.view.state;
            if (!force && state.doc.eq(file.saved)) return;
            const written = await main.call('write', file.path, textOf(state), force ? null : file.mtime);
            // The snapshot written, so text typed during the write stays unsaved.
            commit(file, state.doc, written.mtime);
        });
    }

    async function reloadNow(file, force, seen) {
        if (!force && isDirty(file)) return conflictWith(file, seen ?? file.mtime);
        const before = file.view.state.doc;
        const onDisk = await main.call('read', file.path);
        if (!file.view.state.doc.eq(before)) return conflictWith(file, onDisk.mtime);
        replaceText(file, onDisk.text);
        commit(file, file.view.state.doc, onDisk.mtime);
        return true;
    }

    function reload(file, { force = false } = {}) {
        return queue(file, () => reloadNow(file, force));
    }

    // Queued, so the mtime compared is never one a save under way is about to move.
    function check(file) {
        return queue(file, async () => {
            let status;
            try {
                status = await main.call('stat', file.path);
            } catch {
                return false;
            }
            if (!status.exists)
                return file.trouble?.kind === 'GONE'
                    ? false
                    : troubleWith(file, { kind: 'GONE', message: 'deleted on disk' });
            if (file.trouble?.kind === 'GONE') {
                file.trouble = null;
                onDiskStateChange(file);
            }
            if (Math.abs(status.mtime - file.mtime) <= 1) return false;
            try {
                return await reloadNow(file, false, status.mtime);
            } catch (error) {
                return troubleWith(file, { kind: error.kind, message: error.message });
            }
        });
    }

    async function writeUnopened(path, planned, edit) {
        const onDisk = await main.call('read', path);
        if (planned && Math.abs(onDisk.mtime - planned) > 1) throw refusal('CHANGED', 'it changed after the search');
        const next = edit(onDisk.text);
        if (next !== null) await main.call('write', path, next, onDisk.mtime);
        return next;
    }
}
