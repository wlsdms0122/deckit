import * as POINTER from '../ui/pointer/index.js';
import * as LAYER from '../ui/layer/index.js';
import * as PRESENTATION from '../ui/presentation/index.js';
import * as OVERLAY from '../overlay/renderer.js';
import * as KIT from '../ui/kit/index.js';
import * as FRAME from '../panel/frame.js';
import * as FRAME_PAGE from '../panel/model/page-name.js';
import * as THEME from '../theme/renderer.js';

// MARK: - Property
// Every page the shell draws in: clear around what it draws, and no drag selection, so text meant to be copied
// opts in (ui.selectable).
const PAGE_STYLE = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
    body { -webkit-user-select: none; user-select: none; }
`;

// MARK: - Initializer
// MARK: - Public
// A page the shell made: the panel's frame. `channels` binds the shell's channels in the page.
function page(name, { channels }) {
    if (name === FRAME_PAGE.PAGE_NAME) FRAME.boot(start({ channels }), channels);
}

// Every page the shell draws in starts the same: its look, the pointer, its layers and what is presented, over the page
// and its overlay, in the app's theme, which the overlay wears too. `tell(listener)` calls a listener of the theme's,
// on a mod's page through the mod's own record of what throws, and `channels` binds the theme's channels in the page.
function start({ channels, tell }) {
    KIT.addStyle(PAGE_STYLE);
    const overlay = OVERLAY.open({ channels });
    POINTER.start([window, overlay.window], { isShown: (each) => each === window || LAYER.draws() });
    LAYER.start(overlay);
    PRESENTATION.start({ tell: overlay.presents });
    const theme = THEME.start({ channels, tell });
    theme.onChange(() => LAYER.dress());
    return theme;
}

// MARK: - Private

export { page, start };
