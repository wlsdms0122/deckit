import * as OVERLAY from '../ui/overlay/index.js';
import * as KIT from '../ui/kit/index.js';
import * as STYLE from '../style/renderer.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as FONTS from '../fonts/renderer.js';
import * as FONTS_PERMISSION from '../fonts/model/permission.js';
import * as MOD_PERMISSION from '../../deck/mod/permission.js';
import { createPanel, viewProblem, keyProblem } from '../panel/renderer.js';
import * as PAGE from '../page/renderer.js';
import { createRegion, parentProblem } from '../region/renderer.js';
import { createWindow } from '../window/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What the shell on deckit gives a mod's page (deckit-shell/deckit/mod/renderer.js): the lifecycle it calls,
// attach(shell, deckit) and detach(), and the handle `shell`: the theme, the kit, `show()`, `iconOf(mod)`,
// `formOf(mod)`, `region(element)`, `children`, `web`, with deckit.fonts `fonts`, with deckit.mods the panel's pins on
// `mods`, and the registrations `view`, `window` and, with deckit.styles, `styles`. The page wears the theme, the kit
// and the styles from just before attach(). Once attach() has ended, a view is laid where the panel's guide says, or a
// region's for a child, unless the page is in a window of its own. It reads the class's `icon` and `form` into the
// run's summary, where whatever lists the mods reads them. `WEB` is deckit's web in the page, whose pages the shell
// hands the mod; `channels` binds the shell's channels in the page.
function shellOf({ WEB, channels }) {
    return ({ mod: running, deliver, fail }) => {
        const has = (permission) => running.permissions.some(({ id }) => id === permission);
        const WINDOW = createWindow({ running, fail, deliver, channels });
        const PANEL = createPanel({ channels });
        const REGION = createRegion({ deliver, channels });
        let page = null; // the theme and the kit, once the page wears them
        let unmount = () => {};
        return {
            read: (Entry) => ({ icon: iconOf(Entry, fail), form: formOf(Entry, fail) }),
            registrations: {
                view: { handle: 'shell', check: (value) => viewProblem(value) || parentProblem(value.parent, running) },
                ...(has(STYLE_PERMISSION.STYLES) ? { styles: { handle: 'shell', check: STYLE.problemOf } } : {}),
            },
            blocksKeys: () => OVERLAY.layers.count() > 0,
            // What it tells of a run whose lifecycle of the shell has ended.
            ended: Object.freeze({
                summary: { view: false, sidebar: false, parent: null, styles: [], window: null },
                contributions: { styles: {} },
            }),
            async start(instance, { shell: registered, deckit }, scope) {
                if (typeof instance.attach !== 'function') return;
                page ??= wear();
                const handle = Object.freeze({
                    ...registered,
                    theme: themeOf(page.theme, scope),
                    ui: page.ui,
                    show: PANEL.show,
                    iconOf: PANEL.iconOf,
                    formOf: PANEL.formOf,
                    ...REGION.forScope(scope),
                    web: WEB.surfacesOf({ owner: { deliver, recordFailure: fail }, opener: deckit, scope }),
                    window: WINDOW.register,
                    ...(has(FONTS_PERMISSION.FONTS) ? { fonts: FONTS.tool({ channels }) } : {}),
                    ...(has(MOD_PERMISSION.MODS) ? { mods: PANEL.pins } : {}),
                });
                try {
                    await instance.attach(handle, deckit);
                } catch (error) {
                    throw new Error(`attach() threw: ${error.message || error}`);
                }
            },
            // What is on screen goes first: a view or window there disappears, then detach() runs.
            async end(instance) {
                unmount();
                WINDOW.unmount();
                if (typeof instance.detach !== 'function') return;
                try {
                    await instance.detach();
                } catch (error) {
                    throw new Error(`detach() threw: ${error.message || error}`);
                }
            },
            // A page is laid in one place: one in a window of its own is not in the panel too.
            join(parts) {
                const windowed = WINDOW.has();
                if (parts.view && windowed) fail('shell.view() is for a mod with no window: its page is in its window');
                const view = (!windowed && parts.view) || null;
                if (view) {
                    const tell = (name) => typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                    unmount = PANEL.mount({ theme: page.theme, view, tell, layers: OVERLAY.layers });
                }
                const window = WINDOW.mount();
                const styles = { ...(parts.styles || {}) };
                const shown = !!view || windowed;
                return {
                    summary: {
                        view: !!view,
                        sidebar: !!view?.sidebar,
                        parent: view?.parent || null,
                        styles: Object.keys(styles),
                        window,
                    },
                    contributions: { styles },
                    keyProblem: (key) => keyProblem(key, shown),
                };
            },
        };

        // The page wears what the shell draws with.
        function wear() {
            const theme = PAGE.start({ channels, tell: (listener) => deliver('theme.onChange()', listener) });
            STYLE.wear({ channels });
            return { theme, ui: KIT.make(theme) };
        }
    };
}

// MARK: - Private
// The page's theme on a handle: what it hears is cut with `scope`.
function themeOf(theme, scope) {
    const read = {
        onChange(listener) {
            const off = theme.onChange(listener);
            scope.add(off);
            return off;
        },
    };
    for (const key of Object.keys(theme).filter((key) => key !== 'onChange'))
        Object.defineProperty(read, key, { get: () => theme[key], enumerable: true });
    return Object.freeze(read);
}

// What it reads of a class as it can: one that is not what the shell reads is left out, and a problem.
function iconOf(Entry, fail) {
    const { icon } = Entry;
    if (icon === undefined) return '';
    if (typeof icon === 'string') return icon;
    fail('static icon is no string, so it is left out');
    return '';
}

// Each hint for a key the class's configuration declares: `placeholder`, `unit`, `step`, and `choices`, the name of a
// list the shell has.
function formOf(Entry, fail) {
    const { form, configuration } = Entry;
    if (form === undefined) return {};
    if (!form || typeof form !== 'object') {
        fail('static form is no object, so it is left out');
        return {};
    }
    const declared = configuration && typeof configuration === 'object' ? configuration : {};
    const out = {};
    for (const [key, hints] of Object.entries(form)) {
        if (!Object.hasOwn(declared, key)) {
            fail(`static form has "${key}", which the configuration does not declare, so it is left out`);
            continue;
        }
        if (!hints || typeof hints !== 'object') {
            fail(`static form's "${key}" is no object, so it is left out`);
            continue;
        }
        out[key] = JSON.parse(JSON.stringify(hints));
    }
    return out;
}

export { shellOf };
