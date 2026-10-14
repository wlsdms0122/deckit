const { fileIconOf } = require('./file-type.js');
const { iconElement } = require('./icon-element.js');
const { nameOf, isInside, relativePath, folderOf } = require('./path.js');

const WORKSPACE_SEARCH_STYLE = `
    .editor-search-head { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 2px 0 6px; }
    .editor-search { display: flex; flex-direction: column; min-width: 0; padding: 0 0 8px; }
    .editor-search-scope { display: none; flex-direction: column; gap: 4px; }
    .editor-search-scope[data-open] { display: flex; }
    .editor-search-patterns { display: flex; flex-direction: column; gap: 4px; }
    .editor-search-gap { height: 6px; }
    .editor-search-folders { display: none; align-items: flex-start; gap: 6px; font: 12px var(--deckit-font); min-width: 0; }
    .editor-search-folders[data-shown] { display: flex; }
    .editor-search-folders-action { opacity: 0.7; }
    .editor-search-folders-icon { display: flex; flex: 0 0 auto; opacity: 0.6; padding-top: 3px; }
    .editor-search-chips { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: 2px 4px; min-width: 0; }
    .editor-search-chips-lead { opacity: 0.6; white-space: nowrap; }
    .editor-search-chip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        max-width: 100%;
        min-width: 0;
        padding: 1px 2px 1px 6px;
        border-radius: 5px;
        background: var(--deckit-hover);
    }
    .editor-search-chip-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .editor-search-summary { display: flex; align-items: center; gap: 6px; font: 12px var(--deckit-font); min-height: 20px; padding: 0 0 0 2px; }
    .editor-search-summary-text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.5; }
    .editor-search-warning { font: 11.5px var(--deckit-font); opacity: 0.55; padding: 0 0 0 2px; line-height: 1.4; }
    .editor-search-results { display: flex; flex-direction: column; min-width: 0; }
    .editor-search-file { padding: 0 6px 0 2px; }
    .editor-search-caret {
        display: flex;
        flex: 0 0 12px;
        opacity: 0.5;
        transform: rotate(90deg);
        transition: transform var(--deckit-fast) var(--deckit-easing);
    }
    .editor-search-file[data-collapsed] .editor-search-caret { transform: none; }
    .editor-search-icon { display: flex; flex: 0 0 auto; }
    .editor-search-name { flex: 0 1 auto; min-width: 40px; max-width: 75%; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .editor-search-folder { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: 0.45; font-size: 12px; }
    .editor-search-count {
        flex: 0 0 auto;
        min-width: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: var(--deckit-fill);
        font: 600 11px var(--deckit-font);
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .editor-search-match { padding: 0 6px 0 22px; overflow: hidden; }
    .editor-search-line { flex: 0 0 auto; opacity: 0.4; min-width: 22px; text-align: right; font: 12px var(--deckit-mono); }
    .editor-search-text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font: 12px var(--deckit-mono); }
    .editor-search-hit { background: color-mix(in srgb, var(--deckit-warn) 35%, transparent); border-radius: 2px; }
`;

// Find and replace in the files of a workspace, asked of the main process module. `head` stays put and `element`
// scrolls under it, so the field never scrolls away with its results. Folders are kept out of the include field: there
// a top-level name would match every folder of that name, and a comma or a bracket in a path would be read as syntax.
function workspaceSearch({ ui, fileSystem, root, folders, ranker, onOpen, onReplaceAll }) {
    const SEARCH_DELAY_MS = 250;
    const SUGGESTED = 12;
    // Lines the scope fields up under the find field's text.
    const INSET = 26;
    const EDGE = 2;
    // Characters of context before a match, so the match stays in view.
    const CONTEXT = 12;

    let query = '';
    let options = { caseSensitive: false, word: false, regex: false };
    const scope = { include: '', exclude: '', folders: [] };
    let timer = null;
    let suggestionTurn = 0;
    let searchTurn = 0;
    let running = false;
    // The last answer, which Replace all acts on.
    let last = null;
    const collapsed = new Set();
    // Ranked in a worker: a repository has thousands of folders.
    const folderRanker = ranker({ paths: true });

    const head = ui.element('div', { className: 'editor-search-head' });
    const element = ui.element('div', { className: 'editor-search' });
    const bar = ui.findBar({
        placeholder: 'Find in workspace',
        replace: { onReplaceAll: () => askReplace() },
        onChange: (state) => {
            query = state.query;
            options = { caseSensitive: state.caseSensitive, word: state.word, regex: state.regex };
            searchSoon();
        },
    });
    const includeField = ui.field({
        placeholder: 'Files to include',
        size: 'small',
        icon: ui.icon('fileText', { size: 13 }),
        clearable: true,
        onInput: (value) => {
            scope.include = value;
            rescope();
        },
        onSubmit: () => search(),
    });
    const excludeField = ui.field({
        placeholder: 'Files to exclude',
        size: 'small',
        icon: ui.icon('x', { size: 13 }),
        clearable: true,
        onInput: (value) => {
            scope.exclude = value;
            rescope();
        },
        onSubmit: () => search(),
    });
    const folderSuggestions = ui.autocomplete({
        onPick: (item) => {
            folderField.set('');
            setFolders([...scope.folders, item.relative]);
        },
    });
    const folderField = ui.field({
        placeholder: 'In folder',
        size: 'small',
        icon: ui.icon('folder', { size: 13 }),
        clearable: true,
        onInput: () => suggest(),
    });
    const scopeRows = ui.element('div', { className: 'editor-search-scope', style: { paddingLeft: INSET + 'px' } });
    const patternRows = ui.element('div', { className: 'editor-search-patterns' });
    const filter = ui.toggleButton({
        icon: ui.icon('filter', { size: 13 }),
        title: 'Where to search',
        onChange: (open) => {
            filter.set(open);
            scopeRows.toggleAttribute('data-open', open);
            folderLine.style.paddingLeft = (open ? INSET + EDGE : EDGE) + 'px';
            if (open) includeField.input.focus();
        },
    });
    const folderLine = ui.element('div', { className: 'editor-search-folders', style: { paddingLeft: EDGE + 'px' } });
    const folderIcon = iconElement(ui, 'editor-search-folders-icon', ui.folderIcon({ open: false, size: 12 }));
    const chips = ui.list({ key: (item) => item.relative, create: chipOf });
    const folderClear = ui.rowAction({
        icon: ui.icon('x', { size: 12 }),
        title: 'Search the whole workspace',
        onClick: () => setFolders([]),
    }).element;
    const summary = ui.element('div', { className: 'editor-search-summary' });
    const summaryText = ui.element('span', { className: 'editor-search-summary-text' });
    const warning = ui.element('div', { className: 'editor-search-warning' });
    const results = ui.list({ key: (item) => item.key, create: resultRowOf });

    folderField.input.addEventListener('keydown', (event) => {
        if (!folderSuggestions.isOpen()) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            folderSuggestions.move(event.key === 'ArrowDown' ? 1 : -1);
        else if (event.key === 'Enter') folderSuggestions.pick();
        else if (event.key === 'Escape') folderSuggestions.close();
        else return;
        event.preventDefault();
        event.stopPropagation();
    });
    folderField.input.addEventListener('blur', () => {
        suggestionTurn++;
        folderSuggestions.close();
    });
    patternRows.append(includeField.element, excludeField.element);
    scopeRows.append(patternRows, ui.element('div', { className: 'editor-search-gap' }), folderField.element);
    folderClear.classList.add('editor-search-folders-action');
    chips.element.classList.add('editor-search-chips');
    folderLine.append(folderIcon, chips.element, folderClear);
    summary.append(summaryText, filter.element);
    warning.hidden = true;
    head.append(bar.element, scopeRows, folderLine, summary, warning);
    results.element.classList.add('editor-search-results');
    element.append(results.element);

    return {
        head,
        element,
        focus(text) {
            if (text) {
                bar.setQuery(text);
                query = text;
            }
            bar.focus();
            if (text) search();
        },
        within(relative) {
            setFolders([relative]);
            bar.focus();
        },
        // Called before the workspace's root follows the move.
        follow(move) {
            const top = root();
            if (!top) return;
            const base = move(top) || top;
            followResults(move, base);
            if (!scope.folders.length) return;
            const moved = scope.folders.map((relative) => {
                const at = move(top + '/' + relative);
                return at && isInside(at, base) ? relativePath(at, base) : '';
            });
            if (moved.every((relative, index) => relative === scope.folders[index])) return;
            setFolders(moved);
        },
        close: () => folderRanker.close(),
    };

    function searchSoon() {
        clearTimeout(timer);
        timer = setTimeout(search, SEARCH_DELAY_MS);
    }

    // Marked while any scope is set, even folded away, so a narrowed search never passes for the whole workspace.
    function rescope() {
        searchSoon();
        filter.setMarked(!!(scope.include.trim() || scope.exclude.trim() || scope.folders.length));
    }

    // Picked folders are left out after ranking, so the list the worker holds stays the same and only the query
    // travels.
    async function suggest() {
        const typed = folderField.input.value.trim();
        const turn = ++suggestionTurn;
        if (!typed) return folderSuggestions.close();
        let found = [];
        try {
            const ranked = await folderRanker.rank(await folders(), typed, { limit: SUGGESTED + scope.folders.length });
            if (!ranked) return;
            found = ranked.filter((relative) => !scope.folders.includes(relative)).slice(0, SUGGESTED);
        } catch {}
        if (turn !== suggestionTurn || document.activeElement !== folderField.input) return;
        if (!found.length) return folderSuggestions.close();
        folderSuggestions.show(
            found.map((relative) => ({
                relative,
                label: nameOf(relative),
                hint: folderOf(relative),
                icon: ui.folderIcon({ open: false, size: 14 }),
            })),
            folderField.element.getBoundingClientRect()
        );
    }

    // A single folder is cleared by its own ×.
    function setFolders(list) {
        scope.folders = [...new Set(list.filter(Boolean))];
        chips.set([{ relative: '', lead: true }, ...scope.folders.map((relative) => ({ relative }))]);
        folderClear.style.display = scope.folders.length > 1 ? '' : 'none';
        folderLine.toggleAttribute('data-shown', scope.folders.length > 0);
        rescope();
    }

    function chipOf(item) {
        if (item.lead) return ui.element('span', { className: 'editor-search-chips-lead', text: 'Only in' });
        const chip = ui.element('span', { className: 'editor-search-chip' });
        chip.title = item.relative;
        const remove = ui.rowAction({
            icon: ui.icon('x', { size: 10 }),
            title: 'Not in ' + item.relative,
            onClick: () => setFolders(scope.folders.filter((folder) => folder !== item.relative)),
        }).element;
        remove.classList.add('editor-search-folders-action');
        chip.append(ui.element('span', { className: 'editor-search-chip-name', text: item.relative }), remove);
        return chip;
    }

    // A file moved to the Trash takes its results with it.
    function followResults(move, top) {
        if (!last) return;
        const files = last.files.map((file) => ({ ...file, path: move(file.path) })).filter((file) => file.path);
        if (files.length === last.files.length && files.every((file, index) => file.path === last.files[index].path))
            return;
        for (const path of [...collapsed]) {
            collapsed.delete(path);
            if (move(path)) collapsed.add(move(path));
        }
        last = { ...last, files, total: files.reduce((total, file) => total + file.matches.length, 0) };
        summarize(last);
        draw(top);
    }

    function relativeToRoot(path, top) {
        return top && isInside(path, top) ? relativePath(path, top) : path;
    }

    function draw(top = root()) {
        const items = [];
        for (const file of last?.files || []) {
            const isCollapsed = collapsed.has(file.path);
            items.push({
                key: 'file\n' + file.path,
                path: file.path,
                folder: folderOf(relativeToRoot(file.path, top)),
                count: file.matches.length,
                collapsed: isCollapsed,
            });
            if (isCollapsed) continue;
            for (const match of file.matches)
                items.push({
                    key: `match\n${file.path}\n${match.line}\n${match.column}`,
                    path: file.path,
                    line: match.line,
                    column: match.column,
                    length: match.length,
                    text: match.text,
                });
        }
        results.set(items);
    }

    function resultRowOf(item) {
        return item.line === undefined ? fileRowOf(item) : matchRowOf(item);
    }

    function fileRowOf(item) {
        const row = ui.row({ size: 'small' }).element;
        row.classList.add('editor-search-file');
        row.toggleAttribute('data-collapsed', item.collapsed);
        row.title = item.path;
        row.append(
            iconElement(ui, 'editor-search-caret', ui.icon('chevronRight', { size: 12 })),
            iconElement(ui, 'editor-search-icon', fileIconOf(ui, item.path, 13)),
            ui.element('span', { className: 'editor-search-name', text: nameOf(item.path) }),
            ui.element('span', { className: 'editor-search-folder', text: item.folder }),
            ui.element('span', { className: 'editor-search-count', text: String(item.count) })
        );
        row.addEventListener('click', () => {
            if (collapsed.has(item.path)) collapsed.delete(item.path);
            else collapsed.add(item.path);
            draw();
        });
        return row;
    }

    function matchRowOf(item) {
        const row = ui.row({ size: 'small' }).element;
        row.classList.add('editor-search-match');
        const from = Math.max(0, item.column - CONTEXT);
        const before = (from ? '…' : '') + item.text.slice(from, item.column).replace(/^\s+/, '');
        const text = ui.element('span', { className: 'editor-search-text' });
        text.append(
            before,
            ui.element('span', {
                className: 'editor-search-hit',
                text: item.text.slice(item.column, item.column + item.length),
            }),
            item.text.slice(item.column + item.length)
        );
        row.append(ui.element('span', { className: 'editor-search-line', text: String(item.line) }), text);
        row.addEventListener('click', () =>
            onOpen(item.path, { line: item.line, column: item.column, length: item.length })
        );
        return row;
    }

    async function search() {
        clearTimeout(timer);
        timer = null;
        const top = root();
        const asked = query;
        const turn = ++searchTurn;
        warning.hidden = true;
        if (!top || !asked) {
            running = false;
            last = null;
            summaryText.textContent = top ? '' : 'Open a folder to search it';
            draw();
            return;
        }
        running = true;
        summaryText.textContent = 'Searching…';
        let answer;
        try {
            answer = await fileSystem.search(top, asked, { ...options, ...scope });
        } catch (error) {
            if (turn !== searchTurn) return;
            running = false;
            last = null;
            draw();
            // A GONE message from the main process module is already a sentence naming the folders.
            summaryText.textContent = error.kind === 'GONE' ? error.message : 'Could not search: ' + error.message;
            return;
        }
        if (turn !== searchTurn) return;
        running = false;
        last = { ...answer, query: asked, options: { ...options } };
        summarize(last);
        warning.textContent = answer.warning || '';
        warning.hidden = !answer.warning;
        draw();
    }

    // Out of time with nothing found is told apart from "No results", which would read as "nothing uses this".
    function summarize(answer) {
        const files = answer.files.length;
        summaryText.textContent = answer.total
            ? `${answer.total}${answer.truncated ? '+' : ''} result${answer.total === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}`
            : answer.stoppedBy === 'time'
              ? 'Stopped before finding anything: it took too long. Narrow it with the files to include.'
              : 'No results';
    }

    // Only on complete results for the field as it is: while a search is pending, `last` is the previous query's, and a
    // capped answer lists fewer matches than there are.
    function askReplace() {
        const tell = (title, message) => ui.dialog({ title, message, confirmLabel: 'OK' });
        if (timer || running)
            return tell(
                'The search is still running',
                'Replace all works on the results listed, so it waits until they are in.'
            );
        if (!last || !last.total) return;
        if (last.truncated)
            return tell(
                'Too many results to replace at once',
                `The search stopped at ${last.total} results, so it does not list every match. Narrow it with the files to include or exclude, then replace.`
            );
        const files = last.files.length;
        const replacement = bar.replacement();
        const answer = last;
        ui.dialog({
            title: 'Replace all?',
            message:
                `${answer.total} match${answer.total === 1 ? '' : 'es'} in ${files} file${files === 1 ? '' : 's'} will be replaced with “${replacement}”. ` +
                'Files open here with unsaved changes are left out; save them and search again to include them. A file or a match that changed since the search is left as it is.',
            confirmLabel: 'Replace',
            cancelLabel: 'Cancel',
            destructive: true,
            onConfirm: async () => {
                const done = await onReplaceAll(answer.files, {
                    pattern: answer.pattern,
                    replacement,
                    options: answer.options,
                });
                await search();
                if (done.skipped)
                    tell(
                        `${done.skipped} match${done.skipped === 1 ? ' was' : 'es were'} not replaced`,
                        `${done.replaced} replaced. The rest were skipped because ${done.reason}.`
                    );
            },
        });
    }
}

module.exports = { WORKSPACE_SEARCH_STYLE, workspaceSearch };
