import * as TONE from './model/tone.js';
import * as PROTOCOL from './protocol.js';

export function createCommand() {
    // MARK: - Property
    // The functions behind the entries each session was handed, which holds only their ids, until it ends.
    const sessions = new Map(); // session -> Map of id -> { run, submenu }
    const ended = new Set(); // sessions whose late answers keep nothing
    const searching = new Map(); // entry id -> the AbortController of its query in flight
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // A mod as a source of commands. What it returns is checked here, and an entry with no label is left out and
    // told to `fail` rather than taking every other mod's search down. A function of the mod's that throws or rejects
    // is told to `fail` too, and answers nothing.
    // `icon` is the mod's, which an entry with none of its own is drawn with.
    function source({ icon, commands, now, resolve, fail }) {
        const strings = (list) => (Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : []);
        PROTOCOL.source.send({ resolves: typeof resolve === 'function' });

        const entryOf = (session, command, kind) => {
            if (typeof command?.label !== 'string' || !command.label) {
                fail(`a command needs a label (${kind})`);
                return null;
            }
            const id = 'entry-' + ++sequence;
            const submenu = isSubmenu(command.submenu) ? command.submenu : null;
            localOf(session).set(id, { run: typeof command.run === 'function' ? command.run : null, submenu });
            return {
                id,
                group: typeof command.group === 'string' ? command.group : '',
                label: command.label,
                hint: typeof command.hint === 'string' ? command.hint : '',
                icon: command.icon || icon || '',
                keywords: strings(command.keywords).join(' '),
                address: typeof command.address === 'string' ? command.address : '',
                runnable: typeof command.run === 'function' || !!submenu,
                submenu: submenu
                    ? {
                          placeholder: String(submenu.placeholder || ''),
                          icon: icon || '',
                          ranked: typeof submenu.entries === 'function',
                      }
                    : null,
            };
        };

        PROTOCOL.collect.handle(({ session }) => {
            const offered = commands?.();
            return (Array.isArray(offered) ? offered : [])
                .filter((command) => command && (typeof command.run === 'function' || isSubmenu(command.submenu)))
                .map((command) => entryOf(session, command, 'command'))
                .filter(Boolean);
        });
        PROTOCOL.collectNow.handle(async ({ session }) => {
            const rows = await called('now()', () => now?.(), fail);
            return (Array.isArray(rows) ? rows : [])
                .map((row) => {
                    const entry = entryOf(session, row, 'now');
                    // An intent, not a style: the list decides how it is drawn, and that it stops.
                    return (
                        entry && {
                            ...entry,
                            tone: TONE.TONES.includes(row.tone) ? row.tone : 'info',
                            attention: !!row.attention,
                        }
                    );
                })
                .filter(Boolean);
        });
        PROTOCOL.resolve.handle(async ({ session, raw }) => {
            const found = await called('resolve()', () => resolve(raw), fail);
            return (Array.isArray(found) ? found : [])
                .map((command) => {
                    const entry = entryOf(session, command, 'resolved');
                    return entry && { ...entry, fallback: !!command.fallback };
                })
                .filter(Boolean);
        });
        // A search a newer one replaced is aborted and answers null, so its answer never stands for a query.
        PROTOCOL.search.handle(async ({ session, raw, submenu: id }) => {
            const submenu = sessions.get(session)?.get(id)?.submenu;
            if (!submenu) return null;
            searching.get(id)?.abort();
            const asked = new AbortController();
            searching.set(id, asked);
            let found;
            try {
                found =
                    typeof submenu.search === 'function'
                        ? await submenu.search(raw, { signal: asked.signal })
                        : await submenu.entries();
            } catch (error) {
                if (!asked.signal.aborted) fail(`a submenu threw: ${error.message || error}`);
            }
            if (asked.signal.aborted) return null;
            searching.delete(id);
            return (Array.isArray(found) ? found : [])
                .map((command) => entryOf(session, command, 'submenu'))
                .filter(Boolean);
        });
        // What a command's run returns stays in the page: only that it ran crosses back.
        PROTOCOL.run.handle(async ({ session, id }) => {
            const run = sessions.get(session)?.get(id)?.run;
            if (run) await called("a command's run()", run, fail);
        });
        PROTOCOL.end.on(({ session }) => {
            sessions.delete(session);
            ended.add(session);
        });
    }

    // MARK: - Private
    // A session that ended keeps nothing an answer still on its way hands out.
    function localOf(session) {
        if (ended.has(session)) return new Map();
        if (!sessions.has(session)) sessions.set(session, new Map());
        return sessions.get(session);
    }

    // A mod's function: a throw or a rejection is told to `fail`, and answers nothing.
    async function called(what, call, fail) {
        try {
            return await call();
        } catch (error) {
            fail(`${what} threw: ${error.message || error}`);
            return undefined;
        }
    }

    function isSubmenu(submenu) {
        return !!submenu && (typeof submenu.search === 'function' || typeof submenu.entries === 'function');
    }

    return { source };
}
