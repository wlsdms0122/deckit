/* f.saved is the document that was on disk at f.mtime. f.base is the disk version unsaved edits
 * were made over; when it is not the one on disk, f.conflict is that disk version ({ mtime }).
 * These, f.trouble and the line separator are set only here. */
const fileDisk = ({ engine, main, onStandingChange }) => {
    const toDisk = (state) => state.sliceDoc();

    /* CRLF only when every line break is one. Never left to the engine, which would write CR, LF and
     CRLF all back as LF. Line n of the document stays line n of the file counted by "\n", as the
     search and the replace count. */
    const separatorFor = (text) => (text.includes('\r\n') && !/(^|[^\r])\n/.test(text) ? '\r\n' : '\n');
    // A compartment, so replaceText can choose it again.
    const separator = new engine.Compartment();
    const separatorOf = (text) => engine.EditorState.lineSeparator.of(separatorFor(text));
    const separatorExtension = (text) => separator.of(separatorOf(text));
    const docOf = (text) => engine.EditorState.create({ doc: text, extensions: separatorOf(text) }).doc;

    /* Split by the new separator before inserting: an inserted string is split by the old one. Kept
     out of undo: undoing past a reload would restore text the disk no longer has, and the next
     save would write over the other program's change. */
    const replaceText = (f, text) => {
        const lines = separatorOf(text);
        const doc = docOf(text);
        const state = f.view.state;
        f.view.dispatch(
            state.update({
                changes: { from: 0, to: state.doc.length, insert: doc },
                effects: separator.reconfigure(lines),
                selection: { anchor: Math.min(state.selection.main.head, doc.length) },
                annotations: engine.Transaction.addToHistory.of(false),
            })
        );
    };

    // Shaped like an error from main (error.kind), so failureOf reads both.
    const refusal = (kind, message) => Object.assign(new Error(message), { kind });

    const commit = (f, doc, mtime) => {
        f.saved = doc;
        f.mtime = mtime;
        f.base = mtime;
        f.conflict = null;
        f.trouble = null;
        onStandingChange(f);
    };
    // `mtime` is the disk version "Keep mine" is checked against.
    const conflictWith = (f, mtime) => {
        f.conflict = { mtime };
        onStandingChange(f);
        return false;
    };
    const troubleWith = (f, trouble) => {
        f.trouble = trouble;
        onStandingChange(f);
        return false;
    };

    const admit = (f, got, draft) => {
        Object.assign(f, { saved: f.view.state.doc, mtime: got.mtime, base: got.mtime, conflict: null, trouble: null });
        if (draft && typeof draft.text === 'string' && draft.text !== got.text) {
            const base = Number(draft.base) || 0;
            replaceText(f, draft.text);
            f.base = base;
            if (Math.abs(base - got.mtime) > 1) f.conflict = { mtime: got.mtime };
        }
        return f;
    };

    const draftOf = (f) => ({ text: toDisk(f.view.state), base: f.base });

    // One disk operation per file at a time, so each starts from the mtime the last one left.
    const queue = (f, job) => {
        const next = (f.pending || Promise.resolve()).catch(() => {}).then(job);
        f.pending = next;
        return next;
    };

    // A rename or removal moves a file from under its path; a save landing in between would write to the old path.
    const holding = (files, job) => {
        const done = Promise.all(files.map((f) => (f.pending || Promise.resolve()).catch(() => {}))).then(job);
        for (const f of files) f.pending = done;
        return done;
    };

    // If the disk moved again since the conflict was shown, the conflict is shown again with that version.
    const keepMine = (f) =>
        queue(f, async () => {
            if (!f.conflict) return true;
            const got = await main.call('read', f.path);
            if (Math.abs(got.mtime - f.conflict.mtime) > 1) return conflictWith(f, got.mtime);
            commit(f, docOf(got.text), got.mtime);
            return true;
        });

    const save = (f, { force = false } = {}) =>
        queue(f, async () => {
            if (f.conflict && !force) throw refusal('CHANGED', 'changed on disk since it was opened');
            const state = f.view.state;
            if (!force && state.doc.eq(f.saved)) return;
            const r = await main.call('write', f.path, toDisk(state), force ? null : f.mtime);
            // The snapshot written, not the document now: text typed during the write stays unsaved.
            commit(f, state.doc, r.mtime);
        });

    const reloadNow = async (f, force, seen) => {
        if (!force && !f.view.state.doc.eq(f.saved)) return conflictWith(f, seen ?? f.mtime);
        const before = f.view.state.doc;
        const got = await main.call('read', f.path);
        if (!f.view.state.doc.eq(before)) return conflictWith(f, got.mtime);
        replaceText(f, got.text);
        commit(f, f.view.state.doc, got.mtime);
        return true;
    };
    const reload = (f, { force = false } = {}) => queue(f, () => reloadNow(f, force));

    // Queued, so the mtime compared is never one a save under way is about to move.
    const check = (f) =>
        queue(f, async () => {
            let st;
            try {
                st = await main.call('stat', f.path);
            } catch {
                return false;
            }
            if (!st.exists)
                return f.trouble?.kind === 'GONE'
                    ? false
                    : troubleWith(f, { kind: 'GONE', message: 'deleted on disk' });
            if (f.trouble?.kind === 'GONE') {
                f.trouble = null;
                onStandingChange(f);
            }
            if (Math.abs(st.mtime - f.mtime) <= 1) return false;
            try {
                return await reloadNow(f, false, st.mtime);
            } catch (e) {
                return troubleWith(f, failureOf(e));
            }
        });

    const writeUnopened = async (path, planned, edit) => {
        const got = await main.call('read', path);
        if (planned && Math.abs(got.mtime - planned) > 1) throw refusal('CHANGED', 'it changed after the search');
        const next = edit(got.text);
        if (next !== null) await main.call('write', path, next, got.mtime);
        return next;
    };

    return { toDisk, separatorExtension, admit, draftOf, holding, keepMine, save, reload, check, writeUnopened };
};

const failureOf = (e) => ({ kind: (e && e.kind) || null, message: String((e && e.message) || e) });
