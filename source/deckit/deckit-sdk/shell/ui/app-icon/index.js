import { APP_ICON } from '../token/index.js';
import { DEFAULT_ICON } from './model/default.js';

// MARK: - Property
// From this size up an app icon stands on the shadow `icon`; under it a shadow muddies the tile's edge.
const LIFTED = APP_ICON.lead;
const STYLE = `
    .deckit-app-icon { display: block; flex: 0 0 auto; user-select: none; -webkit-user-drag: none; }
    .deckit-app-icon[data-lifted] { filter: var(--deckit-shadow-icon); }
`;
const urls = new Map(); // an icon's text -> its data URL

// MARK: - Initializer
// MARK: - Public
function make() {
    return { appIcon };
}

// A mod's app icon: `icon`, an SVG's text as deckit answers a mod's icon, drawn as an image, or the default icon where
// it is empty. `size` names a size of the token's `appIcon` (`small`, `row`, `lead`, `dock`, `grid`). `alt` is the
// mod's name where nothing beside the icon names it, and empty where a visible name does. An image runs and loads
// nothing, so what an icon holds stays inside it.
function appIcon(icon, { size = 'row', alt = '' } = {}) {
    const px = APP_ICON[size];
    if (!px) throw new Error(`no app icon size named ${size}`);
    const image = document.createElement('img');
    image.className = 'deckit-app-icon';
    image.src = urlOf(icon || DEFAULT_ICON);
    image.width = px;
    image.height = px;
    image.alt = alt;
    image.draggable = false;
    image.decoding = 'sync';
    image.toggleAttribute('data-lifted', px >= LIFTED);
    return image;
}

// MARK: - Private
function urlOf(text) {
    let url = urls.get(text);
    if (!url) {
        url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
        urls.set(text, url);
    }
    return url;
}

export { STYLE, make };
