import * as POINTER from '../ui/pointer/index.js';
import * as OVERLAY from '../ui/overlay/index.js';
import * as KIT from '../ui/kit/index.js';
import * as SWITCHER from '../switcher/renderer.js';
import * as SWITCHER_PAGE from '../switcher/model/page-name.js';
import * as FRAME from '../panel/frame.js';
import * as FRAME_PAGE from '../panel/model/page-name.js';
import * as THEME from '../theme/renderer.js';
import * as LAYER from '../../deckit-driver/layer/index.js';

// MARK: - Property
// Every page the shell draws in: clear around what it draws, and no drag selection, so text meant to be copied
// opts in (ui.selectable).
const PAGE_STYLE = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
    body { -webkit-user-select: none; user-select: none; }
`;

// MARK: - Initializer
// MARK: - Public
// A page the shell made: the switcher's, or the panel's frame. `channels` binds the shell's channels in the page.
function page(name, context) {
    const { channels } = LAYER.checked(context, LAYER.PAGE_CONTEXT, 'what the page is handed');
    if (name === SWITCHER_PAGE.PAGE_NAME) SWITCHER.boot(start({ channels }), channels);
    else if (name === FRAME_PAGE.PAGE_NAME) FRAME.boot(start({ channels }), channels);
}

// Every page the shell draws in starts the same: its look, the pointer and what floats, in the app's theme.
// `tell(listener)` calls a listener of the theme's, on a mod's page through the mod's own record of what throws, and
// `channels` binds the theme's channels in the page.
function start({ channels, tell }) {
    KIT.addStyle(PAGE_STYLE);
    POINTER.start();
    OVERLAY.start();
    return THEME.start({ channels, tell });
}

// MARK: - Private

export { page, start };
