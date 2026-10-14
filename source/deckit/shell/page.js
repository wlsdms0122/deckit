import * as POINTER from './ui/pointer/index.js';
import * as OVERLAY from './ui/overlay/index.js';
import * as KIT from './ui/kit/index.js';
import * as STYLE from './style/page.js';
import * as STYLE_PERMISSION from './style/model/permission.js';
import * as PANEL from './panel/page.js';
import * as SWITCHER from './switcher/page.js';
import * as SWITCHER_PAGE from './switcher/model/page-name.js';
import * as THEME from './theme/page.js';
import { createRegion } from './region/page.js';

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

// What the shell gives a mod's page, as deckit runs it (deckit/mod/page): the theme, the kit, `show()`,
// `region(element)`, `children`, the registrations `view` and, with deckit.styles, `styles`, and on deck.mods
// the panel's pins. Once start() has ended, a view goes in the panel's frame, or a region's for a child.
function mod({ mod: running, chordOf, deliver }) {
    const REGION = createRegion();
    const theme = start();
    const ui = KIT.make(theme);
    STYLE.wear();
    const styles = running.permissions.some(({ id }) => id === STYLE_PERMISSION.STYLES);
    return {
        deck: { theme, ui, show: PANEL.show, region: REGION.make, children: REGION.children },
        mods: PANEL.pins,
        registrations: {
            view: (value) => PANEL.viewProblem(value, running),
            ...(styles ? { styles: STYLE.problemOf } : {}),
        },
        blocksKeys: () => OVERLAY.layers.count() > 0,
        keyProblem: (key, parts) => PANEL.keyProblem(key, parts.view),
        contribute(parts) {
            const view = parts.view || null;
            if (view) {
                const tell = (name) => typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                PANEL.mount({ theme, ui, view, tell, layers: OVERLAY.layers, chordOf });
            }
            const given = { ...(parts.styles || {}) };
            return {
                summary: {
                    view: !!view,
                    sidebar: !!view?.sidebar,
                    parent: view?.parent || null,
                    styles: Object.keys(given),
                },
                contributions: { styles: given },
            };
        },
    };
}

// MARK: - Private
// Every page the shell draws in starts the same: its look, the pointer and what floats, in the app's theme.
function start() {
    KIT.addStyle(PAGE_STYLE);
    POINTER.start();
    OVERLAY.start();
    return THEME.start();
}

export { page, mod };
