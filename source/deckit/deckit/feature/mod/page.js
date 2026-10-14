DeckitModule.define(
    'deckit/feature/mod/page',
    {
        uses: [
            'deckit/config',
            'deckit/module/match',
            'deckit/module/ranker',
            'deckit/service/web/page',
            'deckit/service/notify/page',
            'deckit/service/clipboard/page',
            'deckit/service/runtime/page',
            'deckit/service/open/page',
            'deckit/service/keymap/page',
            'deckit/service/command/page',
            'deckit/service/main-process/page',
            'deckit/service/main-process/model/permission',
            'deckit/service/keymap/model/binding-id',
            'deck/service/deck/model/proxy',
            'host/exports?',
        ],
        provides: ['layerOf'],
    },
    (
        CONFIG,
        MATCH,
        RANKER,
        WEB,
        NOTIFY,
        CLIPBOARD,
        RUNTIME,
        OPEN,
        KEYMAP,
        COMMAND,
        MAIN_PROCESS,
        MAIN_PROCESS_PERMISSION,
        BINDING_ID,
        PROXY,
        HOST
    ) => {
        // MARK: - Property
        // What the shell gives a mod where none is on deckit: nothing.
        const NO_SHELL = Object.freeze({
            deck: {},
            registrations: {},
            blocksKeys: () => false,
            keyProblem: () => '',
            contribute: () => ({}),
        });

        // MARK: - Initializer
        // MARK: - Public
        // What deckit gives a mod on deck (deck/service/deck/page): the web, opening addresses, the clipboard,
        // notices, keys, commands, main process modules, and the shell's. `shell(context)` is what the shell on deckit,
        // if one is, gives the mod: `deck`, the members it adds; `registrations`, the ones it adds, each by its check;
        // `blocksKeys()`, whether a key pressed now is dropped; `keyProblem(key, parts)`, why a key would never run, or
        // ''; and `contribute(parts)`, which answers what main is told of the mod beside deckit's own. Deckit's own
        // members and registrations are never the shell's.
        function layerOf(shell) {
            return ({ mod, deliver, fail }) => {
                WEB.listen();
                NOTIFY.listen(deliver);
                const chordOf = (action) => KEYMAP.chord(BINDING_ID.idOf(BINDING_ID.DECKIT_OWNER, action));
                const given = shell ? { ...NO_SHELL, ...shell({ mod, chordOf, deliver, fail }) } : NO_SHELL;
                const fn = (value) => (typeof value === 'function' ? '' : 'takes a function');
                const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
                return {
                    members: ['icon', 'keywords'],
                    deck: { ...given.deck, ...deckOf(mod, { deliver, fail }) },
                    registrations: {
                        ...given.registrations,
                        keys: table,
                        commands: fn,
                        now: fn,
                        resolve: fn,
                        handleURL: fn,
                    },
                    mods: { restartPending: MAIN_PROCESS.restartPending, restart: RUNTIME.restart },
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
                    has('system.clipboard')
                        ? { readText: CLIPBOARD.readText, writeText: CLIPBOARD.writeText }
                        : { writeText: CLIPBOARD.writeText }
                ),
                ...(has('system.notifications') ? { notify: NOTIFY.notify } : {}),
                ...(has(MAIN_PROCESS_PERMISSION.PERMISSION) ? { mainProcess: MAIN_PROCESS.forMod({ deliver }) } : {}),
                ...(has('deckit.key-map')
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
                ...(has('deckit.url-schemes')
                    ? {
                          urlSchemes: Object.freeze({
                              list: OPEN.handlerLists,
                              set: OPEN.setHandlers,
                              everyScheme: OPEN.EVERY,
                          }),
                      }
                    : {}),
                ...(mod.id === CONFIG.id && HOST ? { host: PROXY.deepFreeze({ ...HOST }) } : {}),
            };
        }

        // What deckit joins of what start() registered, and what main is told of it.
        function contribute(mod, parts, entry, { given, deliver, fail }) {
            const names = mod.urlSchemes;
            const opens = typeof parts.handleURL === 'function';
            if (names.length && !opens)
                fail('manifest.toml names url-schemes, but start() registered no deck.handleURL()');
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
                global: mod.permissions.some(({ id }) => id === 'system.global-keys'),
                problemOf: (key) => given.keyProblem(key, parts),
            });
            KEYMAP.connect({ deliver, blocksKeys: given.blocksKeys });
            const reported = given.contribute(parts) || {};
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
);
