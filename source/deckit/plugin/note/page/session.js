// The open note: on screen is the disk version, plus typing not yet saved, unless a question about the disk is up;
// then nothing is written or typed until it is answered. Every write, rename and move of the open note goes through
// `enqueue`, so a rename or a move never lands between a save's write and its answer.
function session({ theme, ui, main, editor, movePath, onLeave, onRelocate, onRenamed, onMenu }) {
    const SAVE_DELAY_MS = 500;
    const CLOSE = {
        label: 'Close',
        title: 'Close the note; anything typed since the last save is dropped',
        run: () => onLeave(),
    };
    // What each question says and the answers it offers, by the kind of refusal main answered with.
    const TROUBLE = {
        CHANGED: {
            clearsWhenInSync: true,
            summary: 'This note was changed outside the panel while you were editing it.',
            answers: () => [
                {
                    label: 'Use Theirs',
                    title: 'Load the version on disk; your edits since are dropped',
                    run: () => reload(),
                },
                {
                    label: 'Keep Mine',
                    title: 'Write what is on screen over the version on disk',
                    run: () => save({ force: true }),
                },
            ],
        },
        GONE: {
            clearsWhenInSync: true,
            yieldsToChange: true,
            summary: 'This note was moved or deleted outside the panel.',
            answers: () => [
                {
                    label: 'Save It Again',
                    title: 'Write what is on screen back to where it was',
                    run: () => save({ force: true }),
                },
                CLOSE,
            ],
        },
        UNREADABLE: {
            clearsWhenInSync: true,
            yieldsToChange: true,
            showsMessage: true,
            summary: 'This note can no longer be read as text',
            answers: () => [CLOSE],
        },
        TORN: {
            clearsWhenInSync: true,
            showsMessage: true,
            aboutBackup: true,
            summary:
                'A save of this note stopped partway, so the note on disk may be cut short. The version before that save is kept',
            answers: () => [
                ...(note.unsaved
                    ? [
                          {
                              label: "Save What's on Screen",
                              title: 'Write what is on screen to the note; the kept version goes once it is down',
                              run: () => save({ force: true }),
                          },
                      ]
                    : []),
                {
                    label: 'Restore Kept Version',
                    title: 'Put the version from before that save back as the note',
                    run: () => restoreBackup(),
                },
                note.unsaved
                    ? {
                          label: 'Close Without Saving',
                          title: 'Leave the note as it is on disk, with its kept version; what was typed here is dropped',
                          run: () => onLeave(),
                      }
                    : {
                          label: 'Close',
                          title: 'Leave the note and its kept version as they are; it asks again when opened',
                          run: () => onLeave(),
                      },
            ],
        },
        FAILED: {
            showsMessage: true,
            summary: 'Could not save this note',
            answers: () => [
                {
                    label: 'Try Again',
                    title: 'Save it again, the same way as the save that failed',
                    run: () => {
                        const { force } = note.trouble;
                        setTrouble(null);
                        save({ force });
                    },
                },
                {
                    label: 'Close Without Saving',
                    title: 'Close the note; what was typed since the last save is dropped',
                    run: () => onLeave(),
                },
            ],
        },
    };
    const STYLE = `
        .note-session { display: contents; }
        .note-header { flex: 0 0 auto; width: 100%; box-sizing: border-box; padding: 6px 28px 6px; }
        .note-title {
            width: 100%;
            box-sizing: border-box;
            padding: 0;
            border: 0;
            outline: none;
            background: transparent;
            color: var(--deckit-text);
            font: 800 26px var(--deckit-font);
            letter-spacing: -0.01em;
        }
        .note-title-error { min-height: 0; color: var(--deckit-alert); font: var(--deckit-type-small); }
        .note-stamp { min-height: 16px; margin-top: 3px; color: var(--deckit-muted); font: 11.5px var(--deckit-font); }
        .note-banner {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
            margin: 4px 16px 6px;
            padding: 7px 8px 7px 12px;
            border-radius: var(--deckit-radius-medium);
            background: ${ui.alpha(theme.color.warn, 0.16)};
            font: 12.5px var(--deckit-font);
        }
        .note-banner[hidden] { display: none; }
        .note-banner-text { flex: 1 1 auto; }
    `;

    const note = {
        path: null,
        diskTime: null,
        unsaved: false,
        trouble: null,
        pristine: false,
        titleUnapplied: false,
        bom: false,
        eol: '\n',
        generation: 0,
    };
    // Awaited by every gate: a menu opened as the title field loses focus holds the name from before.
    let renaming = null;
    let queue = Promise.resolve();
    let saveTimer = 0;
    let opening = 0;

    ui.addStyle(STYLE);
    const element = ui.element('div', { className: 'note-session' });
    const header = ui.element('div', { className: 'note-header' });
    const titleInput = ui.element('input', { className: 'note-title' });
    const titleError = ui.element('div', { className: 'note-title-error' });
    const stamp = ui.element('div', { className: 'note-stamp' });
    const banner = ui.element('div', { className: 'note-banner' });
    const menuButton = ui.iconButton({
        icon: ui.icon('ellipsis', { size: 16 }),
        title: 'More',
        onClick: () => {
            if (note.path) onMenu(note.path, menuButton.element);
        },
        size: 'small',
    });

    titleInput.spellcheck = false;
    titleInput.placeholder = 'Untitled';
    header.append(titleInput, titleError, stamp);
    element.append(header, banner);
    menuButton.element.addEventListener('mousedown', (event) => event.preventDefault());
    titleInput.addEventListener('input', () => {
        note.titleUnapplied = true;
        note.pristine = false;
    });
    titleInput.addEventListener('keydown', (event) => {
        // A key an input method takes reports 229 before its composition starts.
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter' || event.key === 'ArrowDown') {
            event.preventDefault();
            applyTitle().then(() => editor.focus({ end: event.key === 'Enter' }));
        } else if (event.key === 'Escape') {
            event.preventDefault();
            note.titleUnapplied = false;
            titleInput.value = noteNameOf(note.path || '');
            titleError.textContent = '';
            editor.focus();
        }
    });
    titleInput.addEventListener('blur', () => {
        applyTitle();
    });
    draw();

    return {
        element,
        menuButton: menuButton.element,
        path: () => note.path,
        text: () => editor.text(),
        open,
        close,
        closeWithoutSaving,
        settle,
        idle,
        enqueue,
        edited,
        save,
        saveIfUnsaved: () => {
            if (note.unsaved) save();
        },
        reconcile,
        relocate: (from, to) => {
            if (!note.path) return;
            note.path = movePath(note.path, from, to);
            draw();
        },
        isBlank,
        markPristine: () => {
            note.pristine = true;
        },
        focusTitle: () => {
            titleInput.focus();
            titleInput.select();
        },
        setFont: (font) => {
            titleInput.style.fontFamily = font;
        },
    };

    // Answers "ok", "blocked" (the open note holds, or another opening overtook this one) or "gone".
    async function open(path, { focus = false, quiet = false } = {}) {
        if (path === note.path) {
            if (focus) editor.focus({ end: true });
            return 'ok';
        }
        const attempt = ++opening;
        if (!(await settle())) return 'blocked';
        if (attempt !== opening) return 'blocked';
        const blank = isBlank() ? note.path : null;
        let read;
        try {
            read = await main.call('read', path);
        } catch (error) {
            if (!quiet)
                ui.dialog({ title: 'Could not open ' + noteNameOf(path), message: error.message, confirmLabel: 'OK' });
            return 'gone';
        }
        if (attempt !== opening) return 'blocked';
        Object.assign(note, {
            path,
            diskTime: read.mtime,
            unsaved: false,
            trouble: null,
            pristine: false,
            titleUnapplied: false,
            bom: read.bom,
            eol: read.eol,
            generation: note.generation + 1,
        });
        titleError.textContent = '';
        editor.open({ text: read.text });
        draw();
        discard(blank);
        if (read.torn) setTrouble(troubleOf('TORN'));
        if (focus) editor.focus({ end: true });
        return 'ok';
    }

    // Answers "ok", or "blocked" while the note holds.
    async function close() {
        if (!note.path) return 'ok';
        const attempt = ++opening;
        if (!(await settle()) || attempt !== opening) return 'blocked';
        const blank = isBlank() ? note.path : null;
        closeWithoutSaving();
        discard(blank);
        return 'ok';
    }

    // Drops unsaved typing: the caller has saved or chosen not to.
    function closeWithoutSaving() {
        clearTimeout(saveTimer);
        Object.assign(note, {
            path: null,
            diskTime: null,
            unsaved: false,
            trouble: null,
            pristine: false,
            titleUnapplied: false,
            generation: note.generation + 1,
        });
        editor.close();
        draw();
    }

    // The gate before anything leaves, moves, renames or removes the open note, or with `path` a folder holding it.
    // Resolves false, with the question nudged, while anything typed is not on disk. A question with nothing unsaved
    // behind it (a torn note only looked at) holds no one.
    async function settle(path = null) {
        if (renaming) await renaming;
        if (!note.path || (path != null && !isWithin(note.path, path))) return true;
        if (note.titleUnapplied && !(await applyTitle())) return false;
        for (let attempt = 0; attempt < 3 && note.unsaved && !note.trouble; attempt++) await save();
        if (note.unsaved) {
            nudge();
            return false;
        }
        await enqueue(() => {});
        return true;
    }

    async function idle() {
        if (renaming) await renaming;
        await enqueue(() => {});
    }

    function enqueue(step) {
        queue = queue.catch(() => {}).then(step);
        return queue;
    }

    function edited() {
        note.unsaved = true;
        note.pristine = false;
        scheduleSave();
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => save(), SAVE_DELAY_MS);
    }

    // Resolves whether the note is in step with the disk. `force` writes without the check against the disk version.
    function save({ force = false } = {}) {
        clearTimeout(saveTimer);
        saveTimer = 0;
        return enqueue(async () => {
            if (!note.path) return true;
            if (note.trouble && !force) return false;
            if (!note.unsaved && !force) return true;
            const { path, generation } = note;
            const text = editor.text();
            try {
                const written = await main.call('write', path, text, force ? null : note.diskTime, {
                    bom: note.bom,
                    eol: note.eol,
                });
                if (generation !== note.generation) return true;
                note.diskTime = written.mtime;
                // Typed while the write was in flight: still unsaved.
                note.unsaved = editor.text() !== text;
                if (note.trouble) setTrouble(null);
                else draw();
                if (note.unsaved) scheduleSave();
                return !note.unsaved;
            } catch (error) {
                if (generation !== note.generation) return false;
                setTrouble({ ...troubleOf(error.kind, error), force });
                return false;
            }
        });
    }

    function reload() {
        return enqueue(async () => {
            const { path, generation } = note;
            if (!path) return;
            try {
                const read = await main.call('read', path);
                if (generation !== note.generation) return;
                showDiskVersion(read);
                note.unsaved = false;
                setTrouble(null);
            } catch (error) {
                if (generation === note.generation) setTrouble(readTroubleOf(error));
            }
        });
    }

    // Brings the screen and the disk together after a change on disk, or asks.
    function reconcile() {
        return enqueue(async () => {
            const { path, generation } = note;
            if (!path) return;
            let read;
            try {
                read = await main.call('read', path);
            } catch (error) {
                if (generation === note.generation) setTrouble(readTroubleOf(error));
                return;
            }
            if (generation !== note.generation) return;
            const trouble = note.trouble && TROUBLE[note.trouble.kind];
            // Torn by a save here or in an earlier session.
            if (read.torn) {
                if (!trouble?.aboutBackup) setTrouble(troubleOf('TORN'));
                return;
            }
            // The disk matches the screen: saved the same elsewhere, restored, checked out again.
            if (read.text === editor.text()) {
                Object.assign(note, { diskTime: read.mtime, bom: read.bom, eol: read.eol, unsaved: false });
                if (trouble?.clearsWhenInSync) setTrouble(null);
                else draw();
                return;
            }
            if (!trouble && Math.abs(read.mtime - note.diskTime) <= 1) return;
            // Nothing unsaved: the disk version comes in, which also ends a question about the backup.
            if (!note.unsaved && (!trouble || trouble.aboutBackup)) {
                showDiskVersion(read);
                if (trouble) setTrouble(null);
                return draw();
            }
            // Another version is there: a change, whatever the question was (gone and back again is no longer gone).
            if (!trouble || trouble.yieldsToChange) setTrouble(troubleOf('CHANGED'));
        });
    }

    async function restoreBackup() {
        const { path } = note;
        try {
            await enqueue(() => main.call('restore', path));
        } catch (error) {
            ui.dialog({ title: 'Could not restore ' + noteNameOf(path), message: error.message, confirmLabel: 'OK' });
            return;
        }
        note.unsaved = false;
        setTrouble(null);
        reload();
    }

    function applyTitle() {
        if (!note.path || !note.titleUnapplied) return Promise.resolve(true);
        // Cleared before the rename starts, so settle() does not ask for the same rename again.
        note.titleUnapplied = false;
        const renamed = renameToTitle();
        const tracked = renamed.finally(() => {
            if (renaming !== tracked) return;
            renaming = null;
            draw();
        });
        renaming = tracked;
        return renamed;
    }

    async function renameToTitle() {
        const from = note.path;
        const wanted = titleInput.value.trim();
        if (!wanted || wanted === noteNameOf(from)) {
            titleInput.value = noteNameOf(from);
            titleError.textContent = '';
            return true;
        }
        if (!(await settle(from))) {
            titleInput.value = noteNameOf(note.path || from);
            return false;
        }
        let renamed = false;
        await enqueue(async () => {
            try {
                onRelocate(from, (await main.call('rename', from, wanted)).path);
                titleError.textContent = '';
                renamed = true;
            } catch (error) {
                if (note.path !== from) return;
                titleError.textContent = error.message;
                titleInput.value = noteNameOf(from);
            }
        });
        await onRenamed();
        return renamed;
    }

    // Made a moment ago, and its text and name untouched since.
    function isBlank() {
        return note.pristine && !!note.path && !editor.text();
    }

    // Called once the switch is certain, so a failed switch keeps the note.
    function discard(blank) {
        if (blank) main.call('discard', blank).catch(() => {});
    }

    function showDiskVersion(read) {
        editor.replace(read.text);
        Object.assign(note, { diskTime: read.mtime, bom: read.bom, eol: read.eol });
    }

    // A refusal of a kind with no question of its own is FAILED.
    function troubleOf(kind, error = null) {
        const known = TROUBLE[kind] ? kind : 'FAILED';
        return { kind: known, message: TROUBLE[known].showsMessage && error ? error.message : '' };
    }

    function readTroubleOf(error) {
        return troubleOf(error.kind === 'GONE' ? 'GONE' : 'UNREADABLE', error);
    }

    function setTrouble(trouble) {
        note.trouble = trouble;
        editor.setReadOnly(!!trouble);
        draw();
    }

    function draw() {
        const isOpen = !!note.path;
        menuButton.setEnabled(isOpen);
        if (isOpen && !note.titleUnapplied && !renaming && titleInput.value !== noteNameOf(note.path))
            titleInput.value = noteNameOf(note.path);
        titleInput.disabled = !isOpen || !!note.trouble;
        stamp.textContent = isOpen && note.diskTime ? 'Edited ' + longDate(note.diskTime) : '';
        const trouble = note.trouble && TROUBLE[note.trouble.kind];
        banner.hidden = !trouble;
        if (!trouble) return banner.replaceChildren();
        const text = trouble.summary + (note.trouble.message ? ': ' + note.trouble.message : '');
        banner.replaceChildren(
            ui.element('span', { className: 'note-banner-text', text }),
            ...trouble
                .answers()
                .map(
                    ({ label, title, run }) => ui.button({ label, title, onClick: () => run(), size: 'small' }).element
                )
        );
    }

    function nudge() {
        if (!theme.motion.fast) return;
        banner.animate(
            [
                { transform: 'translateX(0)' },
                { transform: 'translateX(-4px)' },
                { transform: 'translateX(4px)' },
                { transform: 'translateX(0)' },
            ],
            { duration: 240, easing: theme.motion.easing }
        );
    }
}
