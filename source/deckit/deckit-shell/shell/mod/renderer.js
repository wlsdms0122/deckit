import * as LAYER from '../ui/layer/index.js';
import * as PRESENTATION from '../ui/presentation/index.js';
import * as KIT from '../ui/kit/index.js';
import * as STYLE from '../style/renderer.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as FONTS from '../fonts/renderer.js';
import * as FONTS_PERMISSION from '../fonts/model/permission.js';
import * as MOD_PERMISSION from '../../deckit/permission/index.js';
import * as KEYS from '../key/renderer.js';
import * as KEY_PERMISSION from '../key/model/permission.js';
import { createPanel, viewProblem } from '../panel/renderer.js';
import * as PAGE from '../page/renderer.js';
import { createRegion } from '../region/renderer.js';
import * as FIELD from '../panel/model/field.js';
import { createDrop } from '../drop/renderer.js';
import { createWindow } from '../window/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The shell as a layer on deckit in a mod's page (deckit-shell/deck/runner/renderer.js), stacked with what deckit
// offers a layer over it (`under`): the lifecycle it calls, attach(shell, deckit) and detach(), and the handle `shell`:
// the theme, the kit, `show()`, `iconOf(mod)`, `region(element, interface)`, `children`, `dropDestination(element,
// options)`, `web`, with deckit.fonts `fonts`, with deckit.mods the Dock on `mods`, with deckit.shell-keys the shell's
// own keys on `keys`, and `view.register()`, `window.register()` and, with deckit.styles, `styles.register()`. The
// page wears the theme, the kit and the styles from just before attach().
// Once attach() has ended, a view is laid where the panel's guide says, or a region's for a child, unless the page is
// in a window of its own. A view is registered only by a mod whose manifest fields give one, with a sidebar only where
// they say the view lends one. `WEB` is deckit's web in the page, whose pages the shell hands the mod; `channels` binds
// the shell's channels in the page.
function shellOf({ WEB, channels }) {
    return ({ mod: running, deliver, fail, under: deckit }) => {
        const has = (permission) => running.permissions.some(({ id }) => id === permission);
        const WINDOW = createWindow({ running, fail, deliver, channels });
        const PANEL = createPanel({ channels });
        const REGION = createRegion({ running, deliver, channels });
        const DROP = createDrop({ deliver, channels });
        // What it tells of the run: nothing until its lifecycle has joined, nothing on screen once it has ended.
        const ENDED = Object.freeze({
            summary: { view: false, styles: [], window: null },
            contributions: { styles: {} },
        });
        let reported = {};
        let page = null; // the theme and the kit, once the page wears them
        let mounted = { unmount() {}, remove() {} };
        return {
            report: () => reported,
            lifecycles: [
                deckit.lifecycle({
                    method: 'attach',
                    registrations: {
                        view: {
                            handle: 'shell',
                            check: (value) => viewProblem(value) || fieldProblem(value),
                        },
                        ...(has(STYLE_PERMISSION.STYLES)
                            ? { styles: { handle: 'shell', check: STYLE.problemOf } }
                            : {}),
                    },
                    async start(instance, handles, scope) {
                        scope.add(() => (reported = ENDED));
                        if (typeof instance.attach !== 'function') return;
                        page ??= wear();
                        const opener = handles.deckit;
                        const handle = Object.freeze({
                            ...(handles.shell ?? {}),
                            theme: themeOf(page.theme, scope),
                            ui: page.ui,
                            show: PANEL.show,
                            iconOf: PANEL.iconOf,
                            ...REGION.forScope(scope),
                            ...DROP.forScope(scope),
                            web: WEB.surfacesOf({ owner: { deliver, recordFailure: fail }, opener, scope }),
                            window: Object.freeze({ register: WINDOW.register }),
                            ...(has(FONTS_PERMISSION.FONTS) ? { fonts: FONTS.tool({ channels }) } : {}),
                            ...(has(MOD_PERMISSION.MODS) ? { mods: PANEL.pins } : {}),
                            ...(has(KEY_PERMISSION.SHELL_KEYS) ? { keys: KEYS.tool({ channels }) } : {}),
                        });
                        try {
                            await instance.attach(handle, opener);
                        } catch (error) {
                            throw new Error(`attach() threw: ${error.message || error}`);
                        }
                    },
                    // What is on screen goes first: a view or window there disappears, then detach() runs, and then
                    // they are taken off the page.
                    async end(instance) {
                        mounted.unmount();
                        WINDOW.unmount();
                        try {
                            if (typeof instance.detach === 'function') await instance.detach();
                        } catch (error) {
                            throw new Error(`detach() threw: ${error.message || error}`);
                        } finally {
                            mounted.remove();
                            WINDOW.remove();
                        }
                    },
                    // A page is laid in one place: one in a window of its own is not in the panel too.
                    join(parts, scope) {
                        const windowed = WINDOW.has();
                        if (parts.view && windowed)
                            fail('shell.view.register() is for a mod with no window: its page is in its window');
                        const view = (!windowed && parts.view) || null;
                        if (view) {
                            const tell = (name) =>
                                typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                            mounted = PANEL.mount({ theme: page.theme, view, tell, presented: PRESENTATION });
                        }
                        const window = WINDOW.mount();
                        const styles = { ...(parts.styles || {}) };
                        reported = {
                            summary: {
                                view: !!view,
                                styles: Object.keys(styles),
                                window,
                            },
                            contributions: { styles },
                        };
                    },
                }),
            ],
        };

        // Why a view does not fit the view the mod's manifest fields give, or ''.
        function fieldProblem(value) {
            const given = FIELD.viewOf(running.fields, running);
            if (!given) return 'is for a mod whose manifest gives a view';
            if (value.sidebar && !given.sidebar) return 'has a sidebar, which the view its manifest gives does not';
            return '';
        }

        // The page wears what the shell draws with.
        function wear() {
            const theme = PAGE.start({ channels, tell: (listener) => deliver('theme.onChange()', listener) });
            STYLE.wear({ channels, onChange: () => LAYER.dress() });
            return { theme, ui: KIT.make(theme, { fonts: FONTS.installed({ channels }) }) };
        }
    };
}

// MARK: - Private
// The page's theme on a handle: what it hears is cut with `scope`.
function themeOf(theme, scope) {
    const read = {
        onChange: (listener) => scope.add(theme.onChange(listener)),
    };
    for (const key of Object.keys(theme).filter((key) => key !== 'onChange'))
        Object.defineProperty(read, key, { get: () => theme[key], enumerable: true });
    return Object.freeze(read);
}

export { shellOf };
