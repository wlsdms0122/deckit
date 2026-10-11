DeckitModule.define(
    'deckit/service/keymap/server',
    {
        uses: [
            'deckit/module/log',
            'deckit/service/storage',
            'deckit/module/chord',
            'deckit/service/keymap/model/global',
            'deckit/service/keymap/model/protocol',
        ],
        provides: ['globalSpec', 'connect'],
    },
    (log, storage, CHORD, HOST, PROTOCOL) => {
        const { app } = require('electron');
        const { guard } = log;
        const { read: readData, write: writeData } = storage.host;

        const load = () => {
            try {
                return JSON.parse(readData('keys') || '{}') || {};
            } catch {
                return {};
            }
        };
        let overrides = load();

        const specOf = (id, fallback) => {
            const own = Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : fallback;
            return own ? CHORD.normal(own) : null;
        };
        /* Said by the page that sees every plugin's shortcuts, the only one that can tell when a change
     collides and is held back. Until it has said, the host's are taken from the saved changes. */
        let hostSaid = null; // { id: spec | null }
        let pageKeys = null; // { page, specs: { id: spec | null } in the order they are tried }
        PROTOCOL.globals.hear(({ host, page: specs }, page) => {
            hostSaid = host;
            pageKeys = { page, specs };
        });
        const globalSpec = (id) =>
            (hostSaid && id in hostSaid ? hostSaid[id] : specOf(id, HOST.GLOBAL[id]?.key)) || null;

        PROTOCOL.overrides.answer(() => overrides);
        PROTOCOL.setOverrides.answer(({ overrides: next }) => {
            overrides = Object.fromEntries(
                Object.entries(next)
                    .filter(([id, spec]) => typeof id === 'string' && typeof spec === 'string')
                    .map(([id, spec]) => [id, spec ? CHORD.normal(spec) || '' : ''])
            );
            writeData('keys', JSON.stringify(overrides));
            return overrides;
        });

        /* Recording happens here, not in the page: a page never hears a chord that is already bound, and
     the app menu would act on Command-W while a person types it into a field. Ending it when the
     asking page goes away matters: otherwise every keystroke in the app would go nowhere. */
        let recording = null; // { wc, timer, off }
        const stop = (tell) => {
            if (!recording) return;
            const { wc, timer, off } = recording;
            clearTimeout(timer);
            off();
            recording = null;
            if (tell) PROTOCOL.recorded.send(wc, { cancel: true });
        };
        PROTOCOL.record.hear(({ on }, wc) => {
            stop(false);
            if (!on) return;
            // Removed when the recording ends, so re-arming does not pile listeners on a long-lived page.
            const end = () => {
                if (recording?.wc === wc) stop(true);
            };
            wc.once('destroyed', end);
            wc.once('did-start-navigation', end);
            recording = {
                wc,
                timer: setTimeout(end, 20 * 1000),
                off: () => {
                    wc.removeListener('destroyed', end);
                    wc.removeListener('did-start-navigation', end);
                },
            };
        });

        const take = (input) => {
            if (!recording) return false;
            const { wc } = recording;
            if (wc.isDestroyed()) {
                stop(false);
                return false;
            }
            if (input.type !== 'keyDown') return true;
            const keys = {
                code: input.code,
                meta: input.meta,
                control: input.control,
                shift: input.shift,
                alt: input.alt,
            };
            if (CHORD.endsRecording(keys)) stop(false);
            PROTOCOL.recorded.send(wc, keys);
            return true;
        };

        let route = { answersFor: () => null, escape: () => false, run: {} };

        const chords = new Map(); // webContents.id -> [{ id, code, meta, ctrl, shift, alt }]
        PROTOCOL.chords.hear(({ chords: list }, sender) => {
            const clean = list.filter((c) => c && typeof c.code === 'string').slice(0, 64);
            if (clean.length) chords.set(sender.id, clean);
            else chords.delete(sender.id);
        });

        // A chord on a text-editing key (Command-Left in a field) belongs to the field while one is focused.
        const typing = new Set(); // webContents.id
        PROTOCOL.typing.hear(({ on }, sender) => {
            if (on) typing.add(sender.id);
            else typing.delete(sender.id);
        });

        const floating = new Set(); // webContents.id
        PROTOCOL.floating.hear(({ on }, sender) => {
            if (on) floating.add(sender.id);
            else floating.delete(sender.id);
        });

        const ownerOf = (wc) => {
            if (chords.has(wc.id)) return wc;
            const other = route.answersFor(wc);
            return other && chords.has(other.id) ? other : null;
        };
        const matchChord = (wc, input) => {
            if (input.type !== 'keyDown') return null;
            if (typing.has(wc.id) && CHORD.editsText(input)) return null;
            const owner = ownerOf(wc);
            const hit = owner && chords.get(owner.id).find((c) => CHORD.matches(c, input));
            return hit ? { owner, hit } : null;
        };

        /* First match wins, host before plugins: Settings reads the same order to say which one never
     runs. Resolved on every keystroke so a remap applies at once. */
        const hostHit = (input) =>
            input.type === 'keyDown'
                ? Object.keys(HOST.GLOBAL).find((id) => CHORD.matches(CHORD.parse(globalSpec(id)), input)) || null
                : null;
        const pageHit = (input) =>
            input.type === 'keyDown' && pageKeys
                ? Object.keys(pageKeys.specs).find((id) => CHORD.matches(CHORD.parse(pageKeys.specs[id]), input)) ||
                  null
                : null;

        const isEscape = (input) =>
            input.type === 'keyDown' &&
            input.code === 'Escape' &&
            !input.meta &&
            !input.control &&
            !input.alt &&
            !input.shift;
        const escapeTo = (wc) => {
            const page = route.answersFor(wc);
            if (!page || page.isDestroyed()) return null;
            const last = !!route.escape(wc);
            return floating.has(page.id) || last ? { page, last } : null;
        };

        /* Routed in main because no page listener hears the others: before-input-event sees every
     webContents, and preventDefault keeps a taken keystroke from the app and the page. */
        guard(app, 'web-contents-created', (_e, wc) => {
            guard(wc, 'before-input-event', (event, input) => {
                if (take(input)) {
                    event.preventDefault();
                    return;
                }
                const escaped = isEscape(input) && escapeTo(wc);
                if (escaped) {
                    event.preventDefault();
                    PROTOCOL.escape.send(escaped.page, { last: escaped.last });
                    return;
                }
                const own = hostHit(input);
                if (own && route.run[own]) {
                    event.preventDefault();
                    route.run[own](wc);
                    return;
                }
                const theirs = pageHit(input);
                if (theirs) {
                    event.preventDefault();
                    PROTOCOL.key.send(pageKeys.page, { id: theirs });
                    return;
                }
                const found = matchChord(wc, input);
                if (!found) return;
                event.preventDefault();
                PROTOCOL.key.send(found.owner, { id: found.hit.id });
            });
            // A reload or a crashed renderer keeps the webContents and its id, but the page's state is gone.
            const forget = () => {
                chords.delete(wc.id);
                typing.delete(wc.id);
                floating.delete(wc.id);
                if (pageKeys?.page === wc) pageKeys = null;
            };
            guard(wc, 'did-start-navigation', (details) => {
                if (details.isMainFrame && !details.isSameDocument) forget();
            });
            guard(wc, 'render-process-gone', forget);
            guard(wc, 'destroyed', forget, { once: true });
        });

        return {
            globalSpec,
            connect: ({ answersFor, escape, run } = {}) => {
                route = {
                    answersFor: typeof answersFor === 'function' ? answersFor : () => null,
                    escape: typeof escape === 'function' ? escape : () => false,
                    run: { ...(run || {}) },
                };
            },
        };
    }
);
