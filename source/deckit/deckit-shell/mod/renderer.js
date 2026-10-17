import * as OVERLAY from '../ui/overlay/index.js';
import * as KIT from '../ui/kit/index.js';
import * as STYLE from '../style/renderer.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as PANEL from '../panel/renderer.js';
import * as PAGE from '../page/renderer.js';
import { createRegion, parentProblem } from '../region/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What the shell gives a mod's page, as deckit runs it (deckit/mod/renderer): the theme, the kit, `show()`,
// `region(element)`, `children`, the registrations `view` and, with deckit.styles, `styles`, and on deck.mods
// the panel's pins. Once start() has ended, a view goes in the panel's frame, or a region's for a child.
function mod({ mod: running, chordOf, deliver }) {
    const REGION = createRegion();
    const theme = PAGE.start();
    const ui = KIT.make(theme);
    STYLE.wear();
    const styles = running.permissions.some(({ id }) => id === STYLE_PERMISSION.STYLES);
    return {
        deck: { theme, ui, show: PANEL.show, region: REGION.make, children: REGION.children },
        mods: PANEL.pins,
        registrations: {
            view: (value) => PANEL.viewProblem(value) || parentProblem(value.parent, running),
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

export { mod };
