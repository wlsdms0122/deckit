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
import * as COMMAND_PERMISSION from '../../deckit/command/model/permission.js';
import { createWindow } from '../../deckit/window/renderer.js';
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
    // notifications, keys, commands, main process modules, a window of its own, and the shell's. It reads the mod's
    // `keywords`, which whatever lists the mods reads in its run's summary. `shellMod(context)` is what the shell on
    // deckit, if one is, gives the mod, told by `hasWindow()` whether the mod laid its page in a window: `members`,
    // what it reads of the entry; `deck`, the members it adds; `registrations`, the
    // ones it adds, each by its check; `blocksKeys()`, whether a key pressed now is dropped; `keyProblem(key, parts)`,
    // why a key would never run, or ''; `mods`, what it adds to `deck.mods` for a mod with deckit.mods; and
    // `contribute(parts, entry)`, which answers what main is told of the mod beside deckit's own. Deckit's own members
    // and registrations are never the shell's.
    function layerOf(shellMod) {
        return ({ mod, deliver, fail }) => {
            WEB.listen();
            NOTIFICATION.listen(deliver);
            const chordOf = (name, { provider = '' } = {}) => KEYMAP.chord(name, { provider });
            const WINDOW = createWindow({ running: mod, fail, deliver });
            const context = { mod, chordOf, hasWindow: WINDOW.has, deliver, fail, channels: CHANNELS };
            const given = shellMod ? { ...NO_SHELL, ...shellMod(context) } : NO_SHELL;
            const functionProblem = (value) => (typeof value === 'function' ? '' : 'takes a function');
            const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
            return {
                members: ['keywords', ...given.members],
                deck: { ...given.deck, ...deckOf(mod, { deliver, fail }), window: WINDOW.register },
                registrations: {
                    ...given.registrations,
                    keys: table,
                    commands: table,
                    handleURL: functionProblem,
                },
                mods: {
                    ...given.mods,
                    pick: MOD_FOLDER.pick,
                    reveal: MOD_FOLDER.reveal,
                    restartPending: MAIN_PROCESS.restartPending,
                    restart: RUNTIME.restart,
                },
                contribute: (parts, entry) => contribute(mod, parts, entry, { given, WINDOW, fail }),
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
            util: Object.freeze({
                match: MATCH.match,
                matchFields: MATCH.matchFields,
                TIER: MATCH.TIER,
                ranker: RANKER.ranker,
                movePath,
                tildify: tildifyOf(),
            }),
            open: (url, options) => OPEN.open(url, options),
            ...(has(OPEN_PERMISSION.FILE_HANDLERS) ? { reveal: OPEN.reveal } : {}),
            fileURL: OPEN.fileURL,
            filePath: OPEN.filePath,
            about: RUNTIME.about,
            chordOf: (name) => KEYMAP.chord(name),
            clipboard: Object.freeze({
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_READ) ? { readText: CLIPBOARD.readText } : {}),
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_WRITE) ? { writeText: CLIPBOARD.writeText } : {}),
            }),
            ...(has(NOTIFICATION_PERMISSION.NOTIFICATIONS) ? { notify: NOTIFICATION.notify } : {}),
            ...(has(MAIN_PROCESS_PERMISSION.MAIN_PROCESS) ? { mainProcess: MAIN_PROCESS.forMod({ deliver }) } : {}),
            ...(has(KEYMAP_PERMISSION.KEYMAP)
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
            ...(has(COMMAND_PERMISSION.COMMAND_REGISTRY) ? { commandRegistry: COMMAND.registry } : {}),
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
    function contribute(mod, parts, entry, { given, WINDOW, fail }) {
        const reported = given.contribute(parts, entry) || {};
        const window = WINDOW.mount();
        const registered = (name) => typeof parts[name] === 'function';
        if (registered('handleURL')) OPEN.answer((url, options) => parts.handleURL(url, options));
        const commands = COMMAND.declare(parts.commands, { invalid: fail });
        const keys = KEYMAP.declare(parts.keys, { invalid: fail, problemOf: (key) => given.keyProblem(key, parts) });
        KEYMAP.hear({ run: COMMAND.runByKey, blocksKeys: given.blocksKeys });
        return {
            // What it registered, by name, beside the shell's, for deckit's core to judge it by.
            contributions: {
                ...reported.contributions,
                keys,
                commands,
                handleURL: registered('handleURL'),
            },
            summary: {
                ...reported.summary,
                keywords: strings(entry.keywords),
                commands: commands.length > 0,
                window,
                urlSchemes: registered('handleURL') ? mod.urlSchemes : [],
            },
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
// `iconOf(mod)`, `region(element)`, `children`, the registrations `view` and, with deckit.styles, `styles`, and on
// deck.mods the panel's pins. Once start() has ended, a view is laid where the panel's guide says, or a region's for a
// child, unless the page is in a window of its own. It reads the mod's `icon` into its run's summary, where whatever
// lists the mods reads it. `channels` binds the shell's channels in the page.
function mod({ mod: running, hasWindow, deliver, fail, channels }) {
    const REGION = createRegion({ deliver, channels });
    const PANEL = createPanel({ channels });
    const theme = PAGE.start({ channels, tell: (listener) => deliver('theme.onChange()', listener) });
    const ui = KIT.make(theme);
    STYLE.wear({ channels });
    const styles = running.permissions.some(({ id }) => id === STYLE_PERMISSION.STYLES);
    return {
        members: ['icon'],
        deck: {
            theme,
            ui,
            show: PANEL.show,
            iconOf: PANEL.iconOf,
            region: REGION.make,
            children: REGION.children,
        },
        mods: PANEL.pins,
        registrations: {
            view: (value) => viewProblem(value) || parentProblem(value.parent, running),
            ...(styles ? { styles: STYLE.problemOf } : {}),
        },
        blocksKeys: () => OVERLAY.layers.count() > 0,
        keyProblem: (key, parts) => keyProblem(key, parts.view || hasWindow()),
        // A page is laid in one place: one in a window of its own is not in the panel too.
        contribute(parts, entry) {
            if (parts.view && hasWindow()) fail('deck.view() is for a mod with no window: its page is in its window');
            const view = (!hasWindow() && parts.view) || null;
            if (view) {
                const tell = (name) => typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                PANEL.mount({ theme, view, tell, layers: OVERLAY.layers });
            }
            const given = { ...(parts.styles || {}) };
            return {
                summary: {
                    icon: String(entry.icon || ''),
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
function strings(list) {
    return Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
}

export { mod };
