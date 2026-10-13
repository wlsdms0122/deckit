const { fileIconOf } = require('./file-type.js');
const { iconElement } = require('./icon-element.js');
const { nameOf } = require('./path.js');

const SIDEBAR_STYLE = `
    .editor-sidebar { display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; overflow: hidden; margin: 0 -12px; }
    .editor-sidebar-top { display: flex; flex-direction: column; flex: 0 0 auto; gap: 10px; padding: 0 12px 6px; }
    .editor-mode-icon { display: flex; }
    .editor-navigator-head { display: flex; flex-direction: column; flex: 0 0 auto; min-width: 0; }
    .editor-navigator {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow-y: auto;
        padding: 0 12px;
    }
    .editor-workspace-icon { display: flex; flex: 0 0 auto; }
    .editor-row-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .editor-unsaved-dot {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.7;
    }
    .editor-open-folder-icon { display: flex; opacity: 0.6; }
    .editor-open-folder-label { opacity: 0.7; }
    .editor-loose-icon { display: flex; }
`;

// The editor's sidebar: the workspaces, and under them the navigator of the one in front, its files or its search, or
// the files opened on their own.
function sidebar({
    ui,
    chordOf,
    util,
    workspaces,
    isUnsaved,
    recentFolders,
    onPickFolder,
    onPickFiles,
    onOpenFolder,
    onSwitch,
    onCloseWorkspace,
    onReorder,
    onMode,
    onShowFile,
}) {
    const OPEN_FOLDER = 'open-folder';

    let frontDrawn = null;

    // A basis of 0: the panel never lets a plugin's sidebar shrink, and one sized by its content would scroll the whole
    // column. The negative margin puts the scrollbar on the sidebar's edge.
    const element = ui.element('div', { className: 'editor-sidebar' });
    const top = ui.element('div', { className: 'editor-sidebar-top' });
    const section = ui.section({
        label: 'Workspaces',
        icon: ui.icon('folders', { size: 16 }),
        actions: [{ title: 'Open', run: openMenu }],
    });
    const workspaceRows = ui.list({ maxRows: 4, key: (item) => item.key, create: workspaceRowOf });
    const modes = ui.segmented({
        items: [
            {
                key: 'files',
                label: 'Files',
                title: 'Files',
                lead: iconElement(ui, 'editor-mode-icon', ui.icon('fileText', { size: 13 })),
            },
            {
                key: 'search',
                label: 'Find',
                title: 'Find in the workspace',
                lead: iconElement(ui, 'editor-mode-icon', ui.icon('search', { size: 13 })),
            },
        ],
        value: 'files',
        size: 'small',
        fill: true,
        onChange: (mode) => onMode(mode),
    });
    const navigatorHead = ui.element('div', { className: 'editor-navigator-head' });
    const navigatorBody = ui.element('div', { className: 'editor-navigator' });
    const looseFiles = ui.list({ key: (item) => item.file, create: looseRowOf });

    section.body.append(workspaceRows.element);
    ui.sortable(workspaceRows, { onReorder });
    ui.tooltip(modes.elementOf('files'), { text: 'Files', chord: () => chordOf('showFiles') });
    ui.tooltip(modes.elementOf('search'), { text: 'Find in the workspace', chord: () => chordOf('showFind') });
    top.append(section.element, modes.element, navigatorHead);
    ui.edgeFade(navigatorBody);
    element.append(top, navigatorBody);

    return { element, draw, drawNavigator };

    function draw() {
        drawWorkspaces();
        drawNavigator();
        workspaces.front()?.tree?.repaint();
    }

    // A workspace being dragged keeps its row until it is let go. The front one is scrolled to only when the front
    // changes, so a list scrolled by hand stays where it was put.
    function drawWorkspaces() {
        const front = workspaces.front();
        const all = workspaces.all();
        workspaceRows.set(
            all.length
                ? all.map((workspace) => ({
                      key: workspace,
                      workspace,
                      root: workspace.root,
                      front: workspace === front,
                      unsaved: isUnsaved(workspace),
                  }))
                : [{ key: OPEN_FOLDER }]
        );
        const frontRow = front && workspaceRows.elementOf(front);
        if (frontRow && front !== frontDrawn && !ui.isFullyVisible(frontRow))
            frontRow.scrollIntoView({ block: 'nearest' });
        frontDrawn = front;
    }

    function drawNavigator() {
        const front = workspaces.front();
        navigatorBody.style.display = front ? 'flex' : 'none';
        modes.element.style.display = front?.root ? 'flex' : 'none';
        if (!front) return;
        if (!front.root) {
            looseFiles.set(front.files.map((file) => ({ path: file.path, file, current: file === front.current })));
            show([], looseFiles.element);
            return;
        }
        modes.set(front.mode);
        const searching = front.mode === 'search';
        show(searching ? [front.search.head] : [], searching ? front.search.element : front.tree.element);
    }

    // Put in only when it is not what is there: putting the same tree in again would take it out first, and the row
    // under the pointer would lose its hover.
    function show(head, body) {
        if (navigatorBody.firstChild !== body) navigatorBody.replaceChildren(body);
        if (navigatorHead.firstChild !== (head[0] ?? null)) navigatorHead.replaceChildren(...head);
    }

    function workspaceRowOf(item) {
        if (!item.workspace) {
            const row = ui.row().element;
            row.append(
                iconElement(ui, 'editor-open-folder-icon', ui.icon('plus', { size: 15 })),
                ui.element('span', { className: 'editor-open-folder-label', text: 'Open Folder…' })
            );
            row.addEventListener('click', () => onPickFolder());
            return row;
        }
        const { element: row, setActive } = ui.row();
        row.title = item.root || 'Files opened on their own';
        row.append(
            iconElement(
                ui,
                'editor-workspace-icon',
                item.root ? ui.folderIcon({ open: item.front, size: 16 }) : ui.icon('fileText', { size: 16 })
            ),
            ui.element('span', { className: 'editor-row-label', text: item.root ? nameOf(item.root) : 'Files' })
        );
        if (item.unsaved) row.append(ui.element('span', { className: 'editor-unsaved-dot' }));
        row.append(
            ui.rowAction({
                icon: ui.icon('x', { size: 14 }),
                title: 'Close workspace',
                onClick: () => onCloseWorkspace(item.workspace),
            }).element
        );
        row.addEventListener('click', () => onSwitch(item.workspace));
        setActive(item.front);
        return row;
    }

    function looseRowOf(item) {
        const { element: row, setActive } = ui.row({ size: 'small' });
        row.append(
            iconElement(ui, 'editor-loose-icon', fileIconOf(ui, item.path, 14)),
            ui.element('span', { className: 'editor-row-label', text: nameOf(item.path) })
        );
        row.title = item.path;
        row.addEventListener('click', () => onShowFile(item.file));
        setActive(item.current);
        return row;
    }

    function openMenu(button) {
        const recent = recentFolders();
        ui.menu({
            items: [
                { label: 'Open Folder…', icon: 'folder', hint: chordOf('openFolder'), run: () => onPickFolder() },
                { label: 'Open File…', icon: 'fileText', hint: chordOf('openFile'), run: () => onPickFiles() },
                ...(recent.length
                    ? [
                          '-',
                          {
                              label: 'Open Recent',
                              icon: 'clock',
                              items: recent.map((path) => ({
                                  label: nameOf(path),
                                  hint: util.tildify(path),
                                  run: () => onOpenFolder(path),
                              })),
                          },
                      ]
                    : []),
            ],
            anchor: button.element,
        });
    }
}

module.exports = { SIDEBAR_STYLE, sidebar };
