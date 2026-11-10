import * as LAYER from '../ui/layer/index.js';
import * as KIT from '../ui/kit/index.js';
import * as STYLE from '../style/renderer.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as FONTS from '../fonts/renderer.js';
import * as REQUEST from '../../deckit/request/index.js';
import { createKeys } from '../key/renderer.js';
import { filesOf } from '../files/renderer.js';
import * as PAGE from '../page/renderer.js';
import { createRegion, viewProblem } from '../region/renderer.js';
import { createDock } from '../dock/renderer.js';
import { createDrop } from '../drop/renderer.js';
import { createWindows } from '../window/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The shell as a layer on deckit in a mod's page (deckit/runner/renderer.js), stacked with what the layers under it
// offer (`under`), over deckit's (`under.deckit`): the lifecycle it calls, attach(shell, deckit, frameworks) and
// detach(), the instance's reopen() as its Dock item is clicked with no window open, and the handle `shell`, every
// member on it whatever the mod is granted: the theme, the kit, `windows`, `region(element, interface)`, `children`,
// `dropDestination(element, options)`, `web`, `keys`, which takes a chord for the mod with the permission its scope
// picks, records the keys pressed in the page and with deckit.shell-keys changes the shell's own, `active()`, whether
// the app is in front, `dialogs`, which asks the person for folders, `reveal(path)`, which shows a path where it lies,
// `fonts`, whose `set` deckit.fonts guards, the Dock on `mods`, which deckit.mods guards, `view.register()`, which
// registers a view for a mod whose manifest fields give its view a parent, and `styles.register()`, which registers
// styles for a mod granted deckit.styles. A request is refused as deckit's handle refuses one (deckit/request), a
// member that answers at once throws its refusal, and a registration answers nothing and is never refused: one that
// does not fit registers nothing. The page wears the theme, the kit and the styles from just before attach(). Once
// attach() has ended, a child's view is laid where a region of its parent's shows it. `web` shows the pages of the
// mod's web sessions, as the web engine's layer offers them (`under.web.surfaces`), what they pass on opened as the
// mod's openExternal opens it. `channels` binds the shell's channels in the page, and `drags` takes the presses in the
// drag regions of a window's content (environment: SHELL_PAGE.drags).
function shellOf({ channels, drags }) {
    return ({ mod: running, granted, deliver, fail, under }) => {
        const has = (permission) => granted.includes(permission);
        // The request `name`, refused NOT_PERMITTED as its channel's guard holds the mod, then for its arguments.
        const request = (name, asked, send) => REQUEST.requestOf(name, { ...asked, mod: running.id, granted }, send);
        const WINDOWS = createWindows({ mod: running.id, granted, deliver, channels, drags });
        const REGION = createRegion({ running, deliver, channels, request, windowOf: WINDOWS.windowOf });
        const DOCK = createDock({ channels, request });
        const DROP = createDrop({ deliver, channels });
        const KEYS = createKeys({ channels });
        // What it tells of the run: nothing until its lifecycle has joined, nothing on screen once it has ended.
        const ENDED = Object.freeze({
            summary: { view: false, styles: [] },
            contributions: { styles: {} },
        });
        let reported = {};
        let page = null; // the theme and the kit, once the page wears them
        let mounted = { unmount() {}, remove() {} };
        return {
            report: () => reported,
            lifecycles: [
                under.deckit.lifecycle({
                    method: 'attach',
                    registrations: {
                        view: { handle: 'shell', check: (value) => viewProblem(value, running) },
                        styles: {
                            handle: 'shell',
                            check: (value) =>
                                has(STYLE_PERMISSION.STYLES)
                                    ? STYLE.problemOf(value)
                                    : `is for a mod granted ${STYLE_PERMISSION.STYLES}`,
                        },
                    },
                    async start(instance, handles, scope, frameworks) {
                        scope.add(() => (reported = ENDED));
                        if (typeof instance.attach !== 'function') return;
                        page ??= wear();
                        const deckit = handles.deckit;
                        const handle = Object.freeze({
                            ...(handles.shell ?? {}),
                            theme: themeOf(page.theme, scope),
                            ui: page.ui,
                            windows: WINDOWS.forScope(scope),
                            ...REGION.forScope(scope),
                            ...DROP.forScope(scope),
                            web: under.web.surfaces({
                                owner: { deliver, recordFailure: fail },
                                open: deckit.openExternal,
                                scope,
                            }),
                            fonts: FONTS.tool({ channels, request }),
                            mods: DOCK.mods,
                            keys: KEYS.forScope(scope, { request }),
                            active: KEYS.activeOf({ request }),
                            ...filesOf({ channels, request }),
                        });
                        if (typeof instance.reopen === 'function') {
                            WINDOWS.reopen(() => deliver('reopen()', () => instance.reopen()));
                            scope.add(() => WINDOWS.reopen(null));
                        }
                        try {
                            await instance.attach(handle, deckit, frameworks);
                        } catch (error) {
                            throw new Error(`attach() threw: ${error.message || error}`);
                        }
                    },
                    // What is on screen goes first: a window or view there disappears, then detach() runs, and then
                    // the view is taken off the page.
                    async end(instance) {
                        WINDOWS.unmount();
                        mounted.unmount();
                        try {
                            if (typeof instance.detach === 'function') await instance.detach();
                        } catch (error) {
                            throw new Error(`detach() threw: ${error.message || error}`);
                        } finally {
                            mounted.remove();
                        }
                    },
                    join(parts) {
                        const view = parts.view || null;
                        if (view) {
                            const tell = (name) =>
                                typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                            mounted = REGION.mount({ view, tell });
                        }
                        const styles = { ...(parts.styles || {}) };
                        reported = {
                            summary: { view: !!view, styles: Object.keys(styles) },
                            contributions: { styles },
                        };
                    },
                }),
            ],
        };

        // The page wears what the shell draws with, and its windows the page's rules as they change.
        function wear() {
            const theme = PAGE.start({ channels, tell: (listener) => deliver('theme.onChange()', listener) });
            STYLE.wear({ channels, onChange: () => LAYER.dress() });
            return { theme, ui: KIT.make(theme, { fonts: FONTS.installed({ channels }) }) };
        }
    };
}

// MARK: - Private
// The page's theme on a handle: what it hears is cut with `scope`. `onChange(listener)` throws its refusal,
// INVALID_ARGUMENT for a listener that is no function.
function themeOf(theme, scope) {
    const read = {
        onChange(listener) {
            if (typeof listener !== 'function')
                throw REQUEST.refusal('call', 'INVALID_ARGUMENT', 'theme.onChange: listener is no function');
            return scope.add(theme.onChange(listener));
        },
    };
    for (const key of Object.keys(theme).filter((key) => key !== 'onChange'))
        Object.defineProperty(read, key, { get: () => theme[key], enumerable: true });
    return Object.freeze(read);
}

export { shellOf };
