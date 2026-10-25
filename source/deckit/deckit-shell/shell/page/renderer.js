import * as POINTER from '../ui/pointer/index.js';
import * as OVERLAY from '../ui/overlay/index.js';
import * as KIT from '../ui/kit/index.js';
import * as FRAME from '../panel/frame.js';
import * as FRAME_PAGE from '../panel/model/page-name.js';
import * as THEME from '../theme/renderer.js';
import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// Every page the shell draws in: clear around what it draws, and no drag selection, so text meant to be copied
// opts in (ui.selectable).
const PAGE_STYLE = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
    body { -webkit-user-select: none; user-select: none; }
`;

// MARK: - Initializer
// MARK: - Public
// What this page is: { page }, the name of a page the shell made, or for a mod's { sessions, attached }, what its web
// sessions are named by and whether the shell's UI is on deckit.
function setup() {
    return PROTOCOL.setup.invoke();
}

// A page the shell made: the panel's frame. `channels` binds the shell's channels in the page.
function page(name, { channels }) {
    if (name === FRAME_PAGE.PAGE_NAME) FRAME.boot(start({ channels }), channels);
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

export { setup, page, start };
