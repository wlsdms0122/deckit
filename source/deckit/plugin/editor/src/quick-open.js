const { fileIconOf } = require('./file-type.js');
const { iconElement } = require('./icon-element.js');
const { nameOf, folderOf } = require('./path.js');

const QUICK_OPEN_STYLE = `
    .editor-quick-open { display: flex; flex-direction: column; min-height: 0; max-height: 60vh; font: 13px var(--deckit-font); }
    .editor-quick-open-field {
        flex: 0 0 42px;
        height: 42px;
        padding: 0 14px;
        border: 0;
        border-bottom: var(--deckit-border);
        outline: none;
        background: transparent;
        color: inherit;
        font: 15px var(--deckit-font);
    }
    .editor-quick-open-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px; }
    .editor-quick-open-message { padding: 12px; opacity: 0.45; }
    .editor-quick-open-icon { display: flex; }
    .editor-quick-open-name { flex: 0 0 auto; font: 600 var(--deckit-type-body); }
    .editor-quick-open-folder {
        flex: 1 1 auto;
        min-width: 0;
        opacity: 0.45;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: 12px var(--deckit-font);
    }
    .editor-quick-open-note { padding: 6px 14px; border-top: var(--deckit-border); opacity: 0.5; font: 11.5px var(--deckit-font); }
`;

// Open Quickly: a file of the front workspace found by part of its name. Ranked in a worker: forty thousand paths take a
// few hundred milliseconds. Two rankers, so a search in the box and one for the command palette's page do not cancel
// each other.
function quickOpen({ ui, ranker, list, root, onOpen }) {
    const SHOWN = 50;
    const TYPING_DELAY_MS = 60;
    const boxRanker = ranker({ paths: true });
    const pageRanker = ranker({ paths: true });

    // The folder is kept with the rows, and a row opens in it, not in whichever is in front by then: two checkouts of
    // one repository list the same relative paths.
    let shown = { root: null, query: '', files: [] };
    let failure = '';
    let filterTurn = 0;
    let listing = false;
    // An Enter pressed before the field's text was ranked. Kept as state, so closing the box or typing more cancels it.
    let pickWhenRanked = false;
    let isOpen = false;
    let modal = null;
    let typing = null;

    const box = ui.element('div', { className: 'editor-quick-open' });
    // The field does not shrink: a long list must not squeeze it.
    const field = ui.element('input', { className: 'editor-quick-open-field' });
    const body = ui.element('div', { className: 'editor-quick-open-body' });
    const message = ui.element('div', { className: 'editor-quick-open-message' });
    const rows = ui.list({ key: (relative) => relative, create: rowOf });
    const cursor = ui.listbox(rows.element, { onPick: (index) => choose(index) });
    const note = ui.element('div', { className: 'editor-quick-open-note' });

    field.placeholder = 'Open Quickly';
    field.spellcheck = false;
    note.hidden = true;
    body.append(message, rows.element);
    box.append(field, body, note);
    field.addEventListener('input', () => {
        // An Enter meant the words before these.
        pickWhenRanked = false;
        clearTimeout(typing);
        typing = setTimeout(() => {
            typing = null;
            filter();
        }, TYPING_DELAY_MS);
    });
    field.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!shown.files.length) return;
            const by = event.key === 'ArrowDown' ? 1 : -1;
            cursor.activate(Math.max(0, Math.min(cursor.active() + by, shown.files.length - 1)));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (typing || listing || shown.query !== field.value || shown.root !== root()) {
                clearTimeout(typing);
                typing = null;
                pickWhenRanked = true;
                filter();
            } else choose(cursor.active());
        }
    });

    // Empty when a newer query cancelled this one.
    return { show, rank: async (files, query) => (await pageRanker.rank(files, query, { limit: SHOWN })) || [] };

    function show() {
        if (isOpen) return field.select();
        isOpen = true;
        shown = { root: null, query: '', files: [] };
        listing = true;
        draw();
        modal = ui.modal({
            chrome: false,
            align: 'top',
            width: 'min(560px, calc(100vw - 40px))',
            fill: (card) => {
                Object.assign(card.style, {
                    padding: '0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                });
                card.append(box);
                return field;
            },
            onClose: () => {
                isOpen = false;
                pickWhenRanked = false;
                modal = null;
            },
        });
        filter();
    }

    function hide() {
        pickWhenRanked = false;
        modal?.close();
    }

    function choose(index) {
        const relative = shown.files[index];
        hide();
        if (relative && shown.root) onOpen(shown.root + '/' + relative);
    }

    async function filter() {
        const turn = ++filterTurn;
        const base = root();
        const query = field.value;
        if (!base) {
            listing = false;
            shown = { root: null, query, files: [] };
            draw();
            return;
        }
        listing = true;
        let listed;
        let why = '';
        try {
            listed = (await list()) || { files: [], truncated: false };
        } catch (error) {
            listed = { files: [], truncated: false };
            why = error.message;
        }
        if (turn !== filterTurn) return;
        if (root() !== base) return filter();
        const ranked = await boxRanker.rank(listed.files, query, { limit: SHOWN });
        if (!ranked || turn !== filterTurn) return;
        if (root() !== base) return filter();
        listing = false;
        failure = why;
        shown = { root: base, query, files: ranked };
        draw();
        note.textContent = listed.truncated
            ? `This folder has more files than can be listed; ${listed.files.length} of them are searched.`
            : '';
        note.hidden = !listed.truncated;
        if (pickWhenRanked && isOpen && query === field.value) {
            pickWhenRanked = false;
            choose(cursor.active());
        }
    }

    function draw() {
        message.hidden = shown.files.length > 0;
        message.textContent = !root()
            ? 'Open a folder first'
            : listing
              ? 'Listing the files…'
              : failure
                ? 'Could not list the files: ' + failure
                : field.value
                  ? 'No matching files'
                  : 'Type part of a file name';
        rows.set(shown.files);
        cursor.set(
            shown.files.map((relative) => ({ element: rows.elementOf(relative), disabled: false })),
            { active: 0 }
        );
    }

    // The listbox marks the active row with `data-active`, which the row paints as chosen.
    function rowOf(relative) {
        const row = ui.row({ size: 'medium' }).element;
        row.append(
            iconElement(ui, 'editor-quick-open-icon', fileIconOf(ui, relative, 15)),
            ui.element('span', { className: 'editor-quick-open-name', text: nameOf(relative) }),
            ui.element('span', { className: 'editor-quick-open-folder', text: folderOf(relative) })
        );
        return row;
    }
}

module.exports = { QUICK_OPEN_STYLE, quickOpen };
