const { nameOf } = require('../notes-folder/path.js');
const { COMPOSE_SHAPES } = require('../icons/icons.js');

// The view's title bar: Back and Forward, the path of the folder in the title's place, whose crumbs take a dragged
// note or folder, and at the end New Note, the window's primary action, before what the screen adds by `trail`.
function navigationBar({ ui, chordOf, onBack, onForward, onGo, onNewNote, acceptDrops }) {
    const backButton = ui.iconButton({
        icon: ui.icon('chevronLeft', { size: 16 }),
        title: 'Back',
        onClick: () => onBack(),
    });
    const forwardButton = ui.iconButton({
        icon: ui.icon('chevronRight', { size: 16 }),
        title: 'Forward',
        onClick: () => onForward(),
    });
    const breadcrumb = ui.breadcrumb({ onGo });

    const newNote = ui.iconButton({
        icon: ui.iconOf(COMPOSE_SHAPES, { size: 16 }),
        title: 'New note',
        onClick: () => onNewNote(),
    });
    ui.tooltip(newNote.element, { text: 'New note', chord: () => chordOf('newNote') });
    const trailing = [newNote.element];
    const bar = ui.titleBar({
        leading: [backButton.element, forwardButton.element],
        title: breadcrumb.element,
        trailing,
    });
    for (const [button, text, action] of [
        [backButton, 'Back', 'back'],
        [forwardButton, 'Forward', 'forward'],
    ]) {
        ui.tooltip(button.element, { text, chord: () => chordOf(action) });
        button.element.addEventListener('mousedown', (event) => event.preventDefault());
    }
    acceptDrops(breadcrumb.element, (under) => {
        const part = breadcrumb.partAt(under);
        return part ? { folder: part.key, mark: part.element } : null;
    });

    return { element: bar.element, trail, draw };

    function trail(element) {
        trailing.push(element);
        bar.set({ trailing });
    }

    function draw(folder, { isFolderShown, canGoBack, canGoForward }) {
        backButton.setEnabled(canGoBack);
        forwardButton.setEnabled(canGoForward);
        const names = folder ? folder.split('/') : [];
        const folders = ['', ...names.map((name, index) => names.slice(0, index + 1).join('/'))];
        breadcrumb.set(
            folders.map((path, index) => ({
                key: path,
                label: path ? nameOf(path) : 'All Notes',
                icon: 'folder',
                current: isFolderShown && index === folders.length - 1,
            }))
        );
    }
}

module.exports = { navigationBar };
