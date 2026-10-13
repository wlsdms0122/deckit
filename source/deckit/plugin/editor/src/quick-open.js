const { fileIconOf } = require('./file-type.js');
const { iconElement } = require('./icon-element.js');
const { nameOf, folderOf } = require('./path.js');

const QUICK_OPEN_STYLE = `
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
    let truncated = 0; // how many files were searched, of a folder with more than can be listed
    // An Enter pressed before the field's text was ranked. Kept as state, so closing the box or typing more cancels it.
    let pickWhenRanked = false;
    let picker = null;
    let typing = null;
    let query = ''; // what was typed last, there again when the box opens again

    // Empty when a newer query cancelled this one.
    return { show, rank: async (files, query) => (await pageRanker.rank(files, query, { limit: SHOWN })) || [] };

    function show() {
        if (picker) return picker.focus();
        shown = { root: null, query: '', files: [] };
        listing = true;
        picker = ui.quickPick({
            placeholder: 'Open Quickly',
            value: query,
            width: 'min(560px, calc(100vw - 40px))',
            key: (relative) => relative,
            create: rowOf,
            onInput: (text) => {
                query = text;
                // An Enter meant the words before these.
                pickWhenRanked = false;
                clearTimeout(typing);
                typing = setTimeout(() => {
                    typing = null;
                    filter();
                }, TYPING_DELAY_MS);
            },
            onPick: (_relative, index) => choose(index),
            onEnter: () => {
                if (typing || listing || shown.query !== picker.text() || shown.root !== root()) {
                    clearTimeout(typing);
                    typing = null;
                    pickWhenRanked = true;
                    filter();
                } else choose(picker.active());
            },
            onClose: () => {
                picker = null;
                pickWhenRanked = false;
            },
        });
        draw();
        filter();
    }

    function choose(index) {
        const relative = shown.files[index];
        pickWhenRanked = false;
        picker?.close();
        if (relative && shown.root) onOpen(shown.root + '/' + relative);
    }

    async function filter() {
        if (!picker) return;
        const turn = ++filterTurn;
        const base = root();
        const query = picker.text();
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
        if (turn !== filterTurn || !picker) return;
        if (root() !== base) return filter();
        const ranked = await boxRanker.rank(listed.files, query, { limit: SHOWN });
        if (!ranked || turn !== filterTurn || !picker) return;
        if (root() !== base) return filter();
        listing = false;
        failure = why;
        shown = { root: base, query, files: ranked };
        truncated = listed.truncated ? listed.files.length : 0;
        draw();
        if (pickWhenRanked && query === picker.text()) choose(picker.active());
    }

    function draw() {
        if (!picker) return;
        const message = !root()
            ? 'Open a folder first'
            : listing
              ? 'Listing the files…'
              : failure
                ? 'Could not list the files: ' + failure
                : picker.text()
                  ? 'No matching files'
                  : 'Type part of a file name';
        picker.set(shown.files, {
            active: 0,
            message: shown.files.length ? '' : message,
            note: truncated ? `This folder has more files than can be listed; ${truncated} of them are searched.` : '',
        });
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
