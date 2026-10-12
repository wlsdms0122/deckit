const { nameOf } = require('./path.js');

const DRAFTS_STYLE = `
    .editor-drafts {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        margin: 8px 14px 0;
        padding: 7px 8px 7px 10px;
        border-radius: 7px;
        border: var(--deckit-border);
        font: 12.5px var(--deckit-font);
        background: color-mix(in srgb, var(--deckit-warn) 10%, transparent);
    }
    .editor-drafts[hidden] { display: none; }
    .editor-drafts-heading { opacity: 0.8; }
    .editor-draft { display: flex; align-items: center; gap: 8px; }
    .editor-draft-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
`;

// Unsaved changes kept in the records as drafts, by path: the panel reloads on every install and plugin change. The
// drafts of files not open are listed, as a notice, with what can be done with them.
function unsavedDrafts({ ui, records, isOpen, openDrafts, pick, saveCopy, onOpen, onSavedAs }) {
    const KEEP_DELAY_MS = 600;

    let keepTimer = null;

    const list = ui.list({ key: (item) => item.path, create: rowOf });

    list.element.classList.add('editor-drafts');
    list.element.hidden = true;

    return { element: list.element, get, keepSoon, forget, follow, show };

    function all() {
        return records.get('drafts', {});
    }

    function get(path) {
        return all()[path];
    }

    function keepSoon() {
        clearTimeout(keepTimer);
        keepTimer = setTimeout(() => {
            const next = Object.fromEntries(openDrafts());
            // Drafts of files not open now are kept: they were not dealt with, only not reopened.
            for (const [path, draft] of Object.entries(all())) if (!isOpen(path)) next[path] = draft;
            records.set('drafts', next);
        }, KEEP_DELAY_MS);
    }

    function forget(path) {
        const drafts = all();
        if (!(path in drafts)) return;
        delete drafts[path];
        records.set('drafts', drafts);
    }

    function follow(move) {
        const drafts = all();
        if (Object.keys(drafts).some((path) => move(path) !== path))
            records.set(
                'drafts',
                Object.fromEntries(Object.entries(drafts).map(([path, draft]) => [move(path), draft]))
            );
    }

    // Drawn with every paint, so a file opened since leaves the list at once: its draft is then the open file's, which a
    // Discard here must not reach.
    function show() {
        const left = Object.entries(all()).filter(([path]) => !isOpen(path));
        list.element.hidden = !left.length;
        list.set(
            left.length
                ? [{ path: '', count: left.length }, ...left.map(([path, draft]) => ({ path, text: draft.text }))]
                : []
        );
    }

    function rowOf(item) {
        if (!item.path) {
            const files = item.count === 1 ? 'a file that is' : item.count + ' files that are';
            return ui.element('div', {
                className: 'editor-drafts-heading',
                text: `Unsaved changes to ${files} not open:`,
            });
        }
        const row = ui.element('div', { className: 'editor-draft' });
        const name = ui.element('div', { className: 'editor-draft-name', text: nameOf(item.path) });
        name.title = item.path;
        row.append(
            name,
            ui.button({
                label: 'Open',
                size: 'small',
                onClick: async () => {
                    if (await onOpen(item.path)) show();
                },
            }).element,
            ui.button({ label: 'Save As…', size: 'small', onClick: () => saveAs(item) }).element,
            ui.button({ label: 'Discard', size: 'small', onClick: () => discard(item.path) }).element
        );
        return row;
    }

    async function saveAs(item) {
        const [path] = await pick('save', item.path);
        if (!path || !(await saveCopy(path, item.text))) return;
        forget(item.path);
        await onSavedAs(path);
        show();
    }

    function discard(path) {
        ui.dialog({
            title: `Discard the changes to ${nameOf(path)}?`,
            message: 'They were never saved, so they are gone once discarded.',
            confirmLabel: 'Discard',
            cancelLabel: 'Cancel',
            destructive: true,
            onConfirm: () => {
                forget(path);
                show();
            },
        });
    }
}

module.exports = { DRAFTS_STYLE, unsavedDrafts };
