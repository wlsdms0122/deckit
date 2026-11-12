// What the file area shows of the tab's folder in place of its entries: the folder loading, failing to be read, empty,
// or holding nothing the filter keeps. A loading screen once shown stays its least time: `holds(then)` answers whether
// it is up still, and `then()` runs once it may go.
function folderStatus({ ui, chordOf, onShowHidden, onReveal, onPrivacySettings }) {
    const STYLE = `
        .finder-status-message { padding: 18px 8px; color: var(--deckit-muted); }
        .finder-status-screen { position: absolute; inset: 0; }
        .finder-status-screen.deckit-skeleton { padding: 4px 12px; }
    `;

    // The rows the folder's skeleton draws while it is read.
    const LOADING_ROWS = 6;
    const element = ui.element('div');
    let loading = null; // the loading screen up, { element, settled }
    let leaving = null; // its least time running out

    ui.addStyle(STYLE);

    return { element, draw, holds };

    function holds(then) {
        if (!loading) return false;
        leaving ??= loading.settled().then(() => {
            loading = leaving = null;
            then();
        });
        return true;
    }

    // `failure` is { title, hint, permission }; `hasHidden` says an empty folder holds hidden entries.
    function draw({ folder, loading: waiting, failure, isEmpty, filtering, hasHidden }) {
        if (waiting) {
            if (!loading) {
                loading = ui.loading.skeleton({ rows: LOADING_ROWS, height: 28 });
                loading.element.classList.add('finder-status-screen');
            }
            if (element.firstChild !== loading.element) element.replaceChildren(loading.element);
        } else if (failure) element.replaceChildren(failureScreen(failure));
        else if (isEmpty && filtering) element.replaceChildren(message('Nothing here matches'));
        else if (isEmpty && folder) element.replaceChildren(emptyScreen(folder, hasHidden));
        else element.replaceChildren();
    }

    function message(text) {
        return ui.element('div', { className: 'finder-status-message', text });
    }

    function failureScreen(failure) {
        const actions = [];
        if (failure.permission)
            actions.push(
                ui.button({ label: 'Open Privacy Settings', title: '', onClick: onPrivacySettings, size: 'small' })
                    .element
            );
        return screenOf({ title: failure.title, hint: failure.hint, actions });
    }

    function emptyScreen(folder, hasHidden) {
        const actions = [];
        if (hasHidden) {
            const showHidden = ui.button({
                label: 'Show Hidden Files',
                title: '',
                onClick: onShowHidden,
                size: 'small',
            });
            ui.tooltip(showHidden.element, { text: 'Show hidden files', chord: () => chordOf('hidden') });
            actions.push(showHidden.element);
        }
        actions.push(
            ui.button({ label: 'Show in Folder', title: '', onClick: () => onReveal(folder), size: 'small' }).element
        );
        return screenOf({
            title: 'This folder is empty',
            hint: hasHidden ? 'What is in it is hidden.' : '',
            actions,
        });
    }

    function screenOf(options) {
        const screen = ui.emptyState({ icon: ui.icon('folder', { size: 44 }), ...options }).element;
        screen.classList.add('finder-status-screen');
        return screen;
    }
}

module.exports = { folderStatus };
