const { placeOf } = require('../address/address.js');
const { faviconOf } = require('../favicon/favicon.js');
const { isFolder } = require('../tree/tree.js');

// The address of a tab that has gone nowhere yet, which shows the start page.
const START = 'about:blank';

// What a tab shows before it goes anywhere, drawn in the area of pages where its page is not shown: the bookmarks as
// tiles, those at the top level first and then each folder's own, a press on one going to it (`onOpen(bookmark)`).
function startPage({ ui, onOpen }) {
    ui.addStyle(`
        .browser-start { position: absolute; inset: 0; overflow-y: auto; display: none; }
        .browser-start[data-shown] { display: block; }
        .browser-start-body { box-sizing: border-box; max-width: 720px; margin: 0 auto; padding: 56px 24px 40px; }
        .browser-start-group + .browser-start-group { margin-top: 32px; }
        .browser-start-heading {
            margin: 0 0 14px 4px;
            color: var(--deckit-muted);
            font: var(--deckit-type-small);
            font-weight: 600;
        }
        .browser-start-tiles { display: grid; grid-template-columns: repeat(auto-fill, 84px); gap: 18px 14px; }
        .browser-start-tile {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 0;
            border: 0;
            background: none;
            color: var(--deckit-text);
            cursor: default;
        }
        .browser-start-icon {
            box-sizing: border-box;
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--deckit-radius-large);
            background: var(--deckit-fill);
            color: var(--deckit-muted);
            font: var(--deckit-type-large);
            font-weight: 600;
            transition: background var(--deckit-fast) var(--deckit-easing);
        }
        .browser-start-icon img { width: 32px; height: 32px; object-fit: contain; border-radius: 6px; }
        .browser-start-tile:hover .browser-start-icon { background: var(--deckit-hover); }
        .browser-start-tile:focus-visible { outline: none; }
        .browser-start-tile:focus-visible .browser-start-icon { box-shadow: 0 0 0 2px var(--deckit-focus); }
        .browser-start-title {
            width: 100%;
            font: var(--deckit-type-small);
            text-align: center;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow-wrap: anywhere;
        }
        .browser-start-empty { position: absolute; inset: 0; }
    `);
    const element = ui.element('div', { className: 'browser-start' });
    const body = ui.element('div', { className: 'browser-start-body' });
    const empty = ui.emptyState({
        icon: ui.icon('star', { size: 44 }),
        title: 'No bookmarks yet',
        hint: 'Pages you bookmark with the star in the address bar show here.',
    });
    empty.element.classList.add('browser-start-empty');

    return { element, show, setShown };

    // The bookmarks as they are now.
    function show(bookmarks) {
        const top = bookmarks.root.children;
        const groups = [
            { title: 'Bookmarks', items: top.filter((node) => !isFolder(node)) },
            ...top.filter(isFolder).map((folder) => ({ title: folder.title, items: folder.children })),
        ].map(({ title, items }) => ({ title, items: items.filter((node) => !isFolder(node)) }));
        const shown = groups.filter(({ items }) => items.length);
        body.replaceChildren(...shown.map(groupOf));
        element.replaceChildren(shown.length ? body : empty.element);
    }

    function setShown(on) {
        element.toggleAttribute('data-shown', on);
    }

    function groupOf({ title, items }) {
        const group = ui.element('section', { className: 'browser-start-group' });
        const tiles = ui.element('div', { className: 'browser-start-tiles' });
        tiles.append(...items.map(tileOf));
        group.append(ui.element('h2', { className: 'browser-start-heading', text: title }), tiles);
        return group;
    }

    function tileOf(bookmark) {
        const name = bookmark.title || placeOf(bookmark.url) || bookmark.url;
        const tile = ui.element('button', { className: 'browser-start-tile' });
        tile.title = bookmark.url;
        const icon = ui.element('span', { className: 'browser-start-icon' });
        const letter = () => (icon.textContent = (placeOf(bookmark.url) || name).replace(/^www\./, '').charAt(0));
        const source = faviconOf(bookmark);
        if (source) {
            const image = ui.element('img');
            Object.assign(image, { alt: '', draggable: false });
            image.addEventListener('error', letter);
            image.src = source;
            icon.append(image);
        } else letter();
        tile.append(icon, ui.element('span', { className: 'browser-start-title', text: name }));
        tile.addEventListener('click', () => onOpen(bookmark));
        return tile;
    }
}

module.exports = { START, startPage };
