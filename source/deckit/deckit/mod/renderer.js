import * as MATCH from '../match/match.js';
import * as RANKER from '../match/ranker.js';
import * as CLIPBOARD from '../clipboard/renderer.js';
import * as RUNTIME from '../runtime/renderer.js';
import * as OPEN from '../open/renderer.js';
import * as MAIN_PROCESS from '../main-process/renderer.js';
import * as MOD_FOLDER from '../mod-folder/renderer.js';
import * as MAIN_PROCESS_PERMISSION from '../main-process/model/permission.js';
import * as BINDING_ID from '../keymap/model/binding-id.js';
import * as CLIPBOARD_PERMISSION from '../clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from '../notification/model/permission.js';
import * as KEYMAP_PERMISSION from '../keymap/model/permission.js';
import * as OPEN_PERMISSION from '../open/model/permission.js';

export function createMod({ CONFIG, WEB, NOTIFICATION, KEYMAP, COMMAND, HOST }) {
    // MARK: - Property
    // What the shell gives a mod where none is on deckit: nothing.
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
    // What deckit gives a mod on deck (deck/renderer): the web, opening addresses, the clipboard, notifications,
    // keys, commands, main process modules, and the shell's. It reads how the mod is listed, its `icon` and
    // `keywords`, which every shell reads in its run's summary. `shellMod(context)` is what the shell on deckit, if
    // one is, gives the mod: `members`, what it reads of the entry; `deck`, the members it adds; `registrations`,
    // the ones it adds, each by its check; `blocksKeys()`, whether a key pressed now is dropped;
    // `keyProblem(key, parts)`, why a key would never run, or ''; `mods`, what it adds to `deck.mods` for a mod
    // with deckit.mods; and `contribute(parts, entry)`, which answers what main is told of the mod beside
    // deckit's own. Deckit's own members and registrations are never the shell's.
    function layerOf(shellMod) {
        return ({ mod, deliver, fail }) => {
            WEB.listen();
            NOTIFICATION.listen(deliver);
            const chordOf = (action) => KEYMAP.chord(BINDING_ID.idOf(BINDING_ID.APP_OWNER, action));
            const given = shellMod ? { ...NO_SHELL, ...shellMod({ mod, chordOf, deliver, fail }) } : NO_SHELL;
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
                modId: mod.id,
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
            chordOf: (action) => KEYMAP.chord(BINDING_ID.idOf(mod.id, action)),
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
            ...(mod.id === CONFIG.id && HOST ? { host: HOST } : {}),
        };
    }

    // What deckit joins of what start() registered, and what main is told of it. The shell's goes first: a view it
    // cannot put up leaves the mod unstarted, with nothing of it joined.
    function contribute(mod, parts, entry, { given, deliver, fail }) {
        const reported = given.contribute(parts, entry) || {};
        const names = mod.urlSchemes;
        const opens = typeof parts.handleURL === 'function';
        if (names.length && !opens) fail('manifest.toml names url-schemes, but start() registered no deck.handleURL()');
        if (opens && !names.length)
            fail('start() registered deck.handleURL(), but manifest.toml names no url-schemes, so nothing asks it');
        if (names.length && opens) OPEN.answer((url, options) => parts.handleURL(url, options));
        COMMAND.source({
            icon: entry.icon,
            commands: guarded('commands', parts.commands, fail),
            now: guarded('now', parts.now, fail),
            resolve: typeof parts.resolve === 'function' ? (query) => parts.resolve(query) : null,
            invalid: fail,
        });
        KEYMAP.scope(parts.keys, {
            invalid: fail,
            global: mod.permissions.some(({ id }) => id === KEYMAP_PERMISSION.GLOBAL_KEYS),
            problemOf: (key) => given.keyProblem(key, parts),
        });
        KEYMAP.hear({ deliver, blocksKeys: given.blocksKeys });
        return {
            contributions: { ...reported.contributions },
            summary: {
                ...reported.summary,
                icon: String(entry.icon || ''),
                keywords: Array.isArray(entry.keywords)
                    ? entry.keywords.filter((word) => typeof word === 'string' && word)
                    : [],
                commands: typeof parts.commands === 'function',
                now: typeof parts.now === 'function',
                resolver: typeof parts.resolve === 'function',
                urlSchemes: opens ? names : [],
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
