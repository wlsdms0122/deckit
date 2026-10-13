const { nameOf } = require('./path.js');

// Back, Forward and the path of the folder, whose crumbs take a dragged note or folder.
function navigationBar({ ui, chordOf, onBack, onForward, onGo, acceptDrops }) {
    const element = ui.element('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flex: '0 0 auto',
            padding: '8px 12px 6px',
            minHeight: '30px',
        },
    });
    const backButton = ui.iconButton({
        icon: ui.icon('chevronLeft', { size: 16 }),
        title: 'Back',
        onClick: () => onBack(),
        size: 'small',
    });
    const forwardButton = ui.iconButton({
        icon: ui.icon('chevronRight', { size: 16 }),
        title: 'Forward',
        onClick: () => onForward(),
        size: 'small',
    });
    const breadcrumb = ui.breadcrumb({ onGo });
    const trailing = ui.element('div', {
        style: { display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' },
    });

    breadcrumb.element.style.margin = '0 6px';
    element.append(backButton.element, forwardButton.element, breadcrumb.element, trailing);
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

    return { element, trailing, draw };

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
