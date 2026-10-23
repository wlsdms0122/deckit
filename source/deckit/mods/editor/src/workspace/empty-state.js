const { iconElement } = require('../icon-element/icon-element.js');
const { nameOf } = require('../path/path.js');

const EMPTY_STATE_STYLE = `
    .editor-empty { position: absolute; inset: 0; display: flex; flex-direction: column; }
    .editor-empty[hidden] { display: none; }
    .editor-recent { display: flex; flex-direction: column; gap: 1px; margin-top: 14px; width: min(420px, 80%); text-align: left; }
    .editor-recent[hidden] { display: none; }
    .editor-recent-heading {
        opacity: 0.45;
        font: 600 11px var(--deckit-font);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 0 8px 4px;
    }
    .editor-recent-icon { display: flex; }
    .editor-recent-name { font-weight: 600; }
    .editor-recent-path { flex: 1 1 auto; min-width: 0; opacity: 0.45; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
`;

// What the editor shows with no file open: what the front workspace is, how to open something, and with no folder in
// front, the recent folders.
function emptyState({ ui, util, chordOf, onQuickOpen, onPickFolder, onPickFiles, onOpenFolder }) {
    const RECENT_SHOWN = 6;

    const element = ui.element('div', { className: 'editor-empty' });
    const quickOpenButton = buttonOf('Open Quickly…', 'quickOpen', onQuickOpen);
    const folderButton = buttonOf('Open Folder…', 'openFolder', onPickFolder);
    const fileButton = buttonOf('Open File…', 'openFile', onPickFiles);
    const state = ui.emptyState({ icon: ui.icon('fileText', { size: 44 }) });
    const recent = ui.list({ key: (item) => item.path, create: recentRowOf });

    recent.element.classList.add('editor-recent');
    recent.element.hidden = true;
    state.element.append(recent.element);
    element.append(state.element);

    return { element, show };

    // `workspace` is the one in front, if any; `recentFolders` are those not open.
    function show(workspace, recentFolders) {
        const root = workspace?.root;
        state.set({
            title: root ? nameOf(root) : workspace ? 'Files' : 'Editor',
            hint: root
                ? 'Pick a file in the navigator, or open one by name with Open Quickly'
                : 'Open a folder to work in it as a workspace',
            actions: root ? [quickOpenButton, folderButton, fileButton] : [folderButton, fileButton],
        });
        const shown = root ? [] : recentFolders.slice(0, RECENT_SHOWN);
        recent.element.hidden = !shown.length;
        recent.set(shown.length ? [{ path: '', heading: true }, ...shown.map((path) => ({ path }))] : []);
    }

    function buttonOf(label, action, run) {
        const { element: button } = ui.button({ label, title: label, onClick: () => run(), size: 'small' });
        ui.tooltip(button, { text: label, chord: () => chordOf(action) });
        return button;
    }

    function recentRowOf(item) {
        if (item.heading) return ui.element('div', { className: 'editor-recent-heading', text: 'Recent folders' });
        const row = ui.row({ size: 'small' }).element;
        row.append(
            iconElement(ui, 'editor-recent-icon', ui.folderIcon({ open: false, size: 14 })),
            ui.element('span', { className: 'editor-recent-name', text: nameOf(item.path) }),
            ui.element('span', { className: 'editor-recent-path', text: util.tildify(item.path) })
        );
        row.addEventListener('click', () => onOpenFolder(item.path));
        return row;
    }
}

module.exports = { EMPTY_STATE_STYLE, emptyState };
