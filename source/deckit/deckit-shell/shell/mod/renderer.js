import * as MATCH from '../match/match.js';
import * as RANKER from '../match/ranker.js';
import * as CLIPBOARD from '../../deckit/clipboard/renderer.js';
import * as RUNTIME from '../../deckit/runtime/renderer.js';
import * as OPEN from '../../deckit/open/renderer.js';
import * as MAIN_PROCESS from '../../deckit/main-process/renderer.js';
import * as MOD_FOLDER from '../../deckit/mod-folder/renderer.js';
import * as MAIN_PROCESS_PERMISSION from '../../deckit/main-process/model/permission.js';
import * as CLIPBOARD_PERMISSION from '../../deckit/clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from '../../deckit/notification/model/permission.js';
import * as KEYMAP_PERMISSION from '../../deckit/keymap/model/permission.js';
import * as OPEN_PERMISSION from '../../deckit/open/model/permission.js';
import * as OVERLAY from '../ui/overlay/index.js';
import * as KIT from '../ui/kit/index.js';
import * as STYLE from '../style/renderer.js';
import * as STYLE_PERMISSION from '../style/model/permission.js';
import { createPanel, viewProblem, keyProblem } from '../panel/renderer.js';
import * as PAGE from '../page/renderer.js';
import { createRegion, parentProblem } from '../region/renderer.js';

// `CHANNELS` is what the shell's layer binds its channels with in the page.
export function createMod({ WEB, NOTIFICATION, KEYMAP, COMMAND, CHANNELS }) {
    // MARK: - Property
    // What the layer over deckit's gives a mod where none is: nothing.
    const NO_SHELL = Object.freeze({
        members: [],
        deck: {},
        registrations: {},
        mods: {},
        blocksKeys: () => false,
        keyProblem: () => '',
        contribute: () => ({}),
    });

    // MARK: - Initializer
    // MARK: - Public
    // What deckit gives a mod on deck (deckit-shell/deck/runner/renderer.js): the web, opening addresses, the clipboard,
    // notifications, keys, commands, main process modules, and the shell's. It reads how the mod is listed, its `icon`
    // and `keywords`, which every shell reads in its run's summary. `shellMod(context)` is what the shell on deckit, if
    // one is, gives the mod: `members`, what it reads of the entry; `deck`, the members it adds; `registrations`, the
    // ones it adds, each by its check; `blocksKeys()`, whether a key pressed now is dropped; `keyProblem(key, parts)`,
    // why a key would never run, or ''; `mods`, what it adds to `deck.mods` for a mod with deckit.mods; and
    // `contribute(parts, entry)`, which answers what main is told of the mod beside deckit's own. Deckit's own members
    // and registrations are never the shell's.
    function layerOf(shellMod) {
        return ({ mod, deliver, fail }) => {
            WEB.listen();
            NOTIFICATION.listen(deliver);
            const chordOf = (action) => KEYMAP.chord(action, { app: true });
            const given = shellMod
                ? { ...NO_SHELL, ...shellMod({ mod, chordOf, deliver, fail, channels: CHANNELS }) }
                : NO_SHELL;
            const functionProblem = (value) => (typeof value === 'function' ? '' : 'takes a function');
            const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
            return {
                members: ['icon', 'keywords', ...given.members],
                deck: { ...given.deck, ...deckOf(mod, { deliver, fail }) },
                registrations: {
                    ...given.registrations,
                    keys: table,
                    commands: functionProblem,
                    now: functionProblem,
                    resolve: functionProblem,
                    handleURL: functionProblem,
                },
                mods: {
                    ...given.mods,
                    pick: MOD_FOLDER.pick,
                    reveal: MOD_FOLDER.reveal,
                    restartPending: MAIN_PROCESS.restartPending,
                    restart: RUNTIME.restart,
                },
                contribute: (parts, entry) => contribute(mod, parts, entry, { given, deliver, fail }),
            };
        };
    }

    // MARK: - Private
    function deckOf(mod, { deliver, fail }) {
        const has = (permission) => mod.permissions.some(({ id }) => id === permission);
        const opener = { open: (url, options) => OPEN.open(url, options) };
        return {
            web: WEB.forMod({
                permissions: mod.permissions.map(({ id }) => id),
                owner: { deliver, recordFailure: fail },
                opener,
            }),
            util: Object.freeze({ match: MATCH.match, ranker: RANKER.ranker, movePath, tildify: tildifyOf() }),
            open: (url, options) => OPEN.open(url, options),
            reveal: OPEN.reveal,
            fileURL: OPEN.fileURL,
            filePath: OPEN.filePath,
            about: RUNTIME.about,
            chordOf: (action) => KEYMAP.chord(action),
            clipboard: Object.freeze(
                has(CLIPBOARD_PERMISSION.CLIPBOARD)
                    ? { readText: CLIPBOARD.readText, writeText: CLIPBOARD.writeText }
                    : { writeText: CLIPBOARD.writeText }
            ),
            ...(has(NOTIFICATION_PERMISSION.NOTIFICATIONS) ? { notify: NOTIFICATION.notify } : {}),
            ...(has(MAIN_PROCESS_PERMISSION.MAIN_PROCESS) ? { mainProcess: MAIN_PROCESS.forMod({ deliver }) } : {}),
            ...(has(KEYMAP_PERMISSION.KEY_MAP)
                ? {
                      keymap: Object.freeze({
                          list: KEYMAP.bindings,
                          set: KEYMAP.bind,
                          reset: KEYMAP.reset,
                          record: KEYMAP.record,
                          onChange: KEYMAP.onChange,
                      }),
                  }
                : {}),
            ...(has(OPEN_PERMISSION.URL_SCHEMES)
                ? {
                      urlSchemes: Object.freeze({
                          list: OPEN.handlerLists,
                          set: OPEN.setHandlers,
                          everyScheme: OPEN.EVERY,
                      }),
                  }
                : {}),
        };
    }

    // What deckit joins of what start() registered, and what main is told of it. The shell's goes first: a view it
    // cannot put up leaves the mod unstarted, with nothing of it joined.
    function contribute(mod, parts, entry, { given, deliver, fail }) {
        const reported = given.contribute(parts, entry) || {};
        const registered = (name) => typeof parts[name] === 'function';
        if (registered('handleURL')) OPEN.answer((url, options) => parts.handleURL(url, options));
        COMMAND.source({
            icon: entry.icon,
            commands: guarded('commands', parts.commands, fail),
            now: guarded('now', parts.now, fail),
            resolve: registered('resolve') ? (query) => parts.resolve(query) : null,
            fail,
        });
        const keys = KEYMAP.declare(parts.keys, { invalid: fail, problemOf: (key) => given.keyProblem(key, parts) });
        KEYMAP.hear({ deliver, blocksKeys: given.blocksKeys });
        return {
            // What it registered, by name, beside the shell's, for deckit's core to judge it by.
            contributions: {
                ...reported.contributions,
                keys,
                commands: registered('commands'),
                now: registered('now'),
                resolve: registered('resolve'),
                handleURL: registered('handleURL'),
            },
            summary: {
                ...reported.summary,
                icon: String(entry.icon || ''),
                keywords: Array.isArray(entry.keywords)
                    ? entry.keywords.filter((word) => typeof word === 'string' && word)
                    : [],
                commands: registered('commands'),
                now: registered('now'),
                resolver: registered('resolve'),
                urlSchemes: registered('handleURL') ? mod.urlSchemes : [],
            },
        };
    }

    // The one place a mod's function is called for a value. Asked again while still answering (its
    // commands() reading something that counts everyone's commands), it gets nothing instead of a loop.
    function guarded(name, ask, fail) {
        if (typeof ask !== 'function') return null;
        let answering = false;
        return () => {
            if (answering) return undefined;
            answering = true;
            try {
                return ask();
            } catch (error) {
                fail(`${name}() threw: ${error.message || error}`);
                return undefined;
            } finally {
                answering = false;
            }
        };
    }

    // A path as it is shown: under the home folder, from `~`.
    function tildifyOf() {
        const { home } = RUNTIME.about();
        return (path) => (path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path);
    }

    // `to` null means gone: a path at or inside `from` becomes null. Paths are "/" separated.
    function movePath(path, from, to) {
        if (typeof path !== 'string' || (path !== from && !path.startsWith(from + '/'))) return path;
        return to == null ? null : to + path.slice(from.length);
    }

    return { layerOf };
}

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What the shell gives a mod's page, the layer over deckit's (`createMod`): the theme, the kit, `show()`,
// `region(element)`, `children`, the registrations `view` and, with deckit.styles, `styles`, and on deck.mods the
// panel's pins. Once start() has ended, a view is laid where the panel's guide says, or a region's for a child.
// `channels` binds the shell's channels in the page.
function mod({ mod: running, deliver, channels }) {
    const REGION = createRegion({ deliver, channels });
    const PANEL = createPanel({ channels });
    const theme = PAGE.start({ channels, tell: (listener) => deliver('theme.onChange()', listener) });
    const ui = KIT.make(theme);
    STYLE.wear({ channels });
    const styles = running.permissions.some(({ id }) => id === STYLE_PERMISSION.STYLES);
    return {
        deck: { theme, ui, show: PANEL.show, region: REGION.make, children: REGION.children },
        mods: PANEL.pins,
        registrations: {
            view: (value) => viewProblem(value) || parentProblem(value.parent, running),
            ...(styles ? { styles: STYLE.problemOf } : {}),
        },
        blocksKeys: () => OVERLAY.layers.count() > 0,
        keyProblem: (key, parts) => keyProblem(key, parts.view),
        contribute(parts) {
            const view = parts.view || null;
            if (view) {
                const tell = (name) => typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                PANEL.mount({ theme, view, tell, layers: OVERLAY.layers });
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
