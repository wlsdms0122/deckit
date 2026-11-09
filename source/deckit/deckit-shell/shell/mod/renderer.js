import * as LAYER from '../ui/layer/index.js';
import * as KIT from '../ui/kit/index.js';
import * as STYLE from '../style/renderer.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import * as FONTS from '../fonts/renderer.js';
import * as FONTS_PERMISSION from '../fonts/model/permission.js';
import * as MOD_PERMISSION from '../../deckit/permission/index.js';
import * as REQUEST from '../../deckit/request/index.js';
import { createKeys } from '../key/renderer.js';
import * as KEY_PERMISSION from '../key/model/permission.js';
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
// detach(), the instance's reopen() as its Dock item is clicked with no window open, and the handle `shell`: the theme,
// the kit, `windows`, `iconOf(mod)`, `region(element, interface)`, `children`, `dropDestination(element, options)`,
// `web`, `keys`, which takes a chord for the mod with the permission its scope picks, records the keys pressed in the
// page and with deckit.shell-keys changes the shell's own, `active()`, whether the app is in front, with deckit.fonts
// `fonts`, with deckit.mods the Dock on `mods`, `view.register()` for a mod whose manifest fields give its view a
// parent, and, with deckit.styles, `styles.register()`. The page wears the theme, the kit and the styles from just
// before attach(). Once attach() has ended, a child's view is laid where a region of its parent's shows it. `web` shows
// the pages of the mod's web sessions, as the web engine's layer offers them (`under.web.surfaces`), what they pass on
// opened as the mod's openExternal opens it. `channels` binds the shell's channels in the page, and `drags` takes the
// presses in the drag regions of a window's content (environment: SHELL_PAGE.drags).
function shellOf({ channels, drags }) {
    return ({ mod: running, granted, deliver, fail, under }) => {
        const has = (permission) => granted.includes(permission);
        const WINDOWS = createWindows({ granted, deliver, channels, drags });
        const REGION = createRegion({ running, deliver, channels, windowOf: WINDOWS.windowOf });
        const DOCK = createDock({ channels });
        const DROP = createDrop({ deliver, channels });
        const KEYS = createKeys({ channels });
        // The request `name`, refused NOT_PERMITTED unless the mod holds one of `guards`, then for its arguments.
        const request = (name, { guards = [], signature }, send) => {
            const denied =
                guards.length && !guards.some(has)
                    ? `${running.id} does not have the ${guards.join(' or ')} permission`
                    : '';
            return REQUEST.requestOf(name, { denied, signature }, send);
        };
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
                        ...(has(STYLE_PERMISSION.STYLES)
                            ? { styles: { handle: 'shell', check: STYLE.problemOf } }
                            : {}),
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
                            iconOf: DOCK.iconOf,
                            ...REGION.forScope(scope),
                            ...DROP.forScope(scope),
                            web: under.web.surfaces({
                                owner: { deliver, recordFailure: fail },
                                open: deckit.openExternal,
                                scope,
                            }),
                            ...(has(FONTS_PERMISSION.FONTS) ? { fonts: FONTS.tool({ channels }) } : {}),
                            ...(has(MOD_PERMISSION.MODS) ? { mods: DOCK.mods } : {}),
                            keys: KEYS.forScope(scope, { changes: has(KEY_PERMISSION.SHELL_KEYS), request }),
                            active: KEYS.active,
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
