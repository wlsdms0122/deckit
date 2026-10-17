import * as POINTER from '../ui/pointer/index.js';
import * as OVERLAY from '../ui/overlay/index.js';
import * as KIT from '../ui/kit/index.js';
import * as SWITCHER from '../switcher/renderer.js';
import * as SWITCHER_PAGE from '../switcher/model/page-name.js';
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
// A page the shell made: the switcher's.
function page(name) {
    if (name !== SWITCHER_PAGE.PAGE_NAME) return;
    SWITCHER.boot(start());
}

// Every page the shell draws in starts the same: its look, the pointer and what floats, in the app's theme.
function start() {
    KIT.addStyle(PAGE_STYLE);
    POINTER.start();
    OVERLAY.start();
    return THEME.start();
}

// MARK: - Private

export { page, start };
