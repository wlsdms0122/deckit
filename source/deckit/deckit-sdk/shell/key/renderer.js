import * as CHANNEL from '../../deckit/channel/index.js';
import * as REQUEST from '../../deckit/request/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// A keystroke: the key by its code, and the modifiers held with it.
const KEYSTROKE = Object.freeze([
    ['code', 'string'],
    ['meta', 'boolean?'],
    ['control', 'boolean?'],
    ['alt', 'boolean?'],
    ['shift', 'boolean?'],
]);
// What `keys.take` takes: the keystroke, what a press runs, and where the chord works.
const TAKES = Object.freeze([
    ['keystroke', 'object', KEYSTROKE],
    ['run', 'function'],
    ['options', 'object?', [['scope', 'string?']]],
]);
// What `keys.set` takes: one of the shell's keys by its id, and its chord, left out for none.
const SETS = Object.freeze([
    ['id', 'string'],
    ['keystroke', 'object?', KEYSTROKE],
]);

// MARK: - Initializer
// MARK: - Public
// `shell.keys` in a mod's page, its channels bound with `channels`. `forScope(scope, { request })` answers it for a
// lifecycle, `request` making each of its requests as the shell's handle guards them: `take(keystroke, run,
// { scope })`, a request, takes `keystroke`, `{ code, meta, control, alt, shift }`, `code` as a keyboard event names the key, in
// `scope`: `app`, every page of the app, with deckit.app-keys, or `global`, every app, with system.global-keys, `run()`
// what each press does. It resolves to `{ held, release }`: `held` whether it works where its scope says, false for a
// chord the system did not give, which works in every page of the app still, and `release()` letting it go, as the end
// of `scope` does; it rejects for a chord another holds. `record(onKeystroke) -> stop`, which throws its refusal, hands
// `onKeystroke(keystroke)` each key pressed in the page, taken from it, until `stop()`, the next record or the end of
// `scope`. The requests deckit.shell-keys guards: `list()` resolves to the shell's keys, `[{ id, name,
// defaultKeystroke, keystroke }]`; `set(id, keystroke)` gives one a chord, `{ code, meta, control, alt, shift }`, or
// none where it is left out, and `reset(id)` its default again, each resolving to the key as kept.
// `activeOf({ request })` answers `active()`, a request that resolves to whether the app is in front.
function createKeys({ channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const runs = new Map(); // the id a chord is taken under -> what a press of it runs
    const recorders = new Map(); // the id a recording is asked under -> what it hands each key to
    let lastTake = 0; // the id the last chord was taken under
    let lastRecording = 0; // the id the last recording was asked under

    // MARK: - Initializer
    // A press of a chord the mod took runs what it took it with, here. What that throws is only logged: no one asked
    // to be told.
    PROTOCOL.pressed.on(async ({ id }) => {
        const run = runs.get(id);
        if (!run) return;
        try {
            await run();
        } catch (error) {
            console.warn('[deckit] what a chord runs threw', error);
        }
    });
    PROTOCOL.recorded.on(({ id, keystroke }) => {
        const recorder = recorders.get(id);
        if (!recorder) return;
        try {
            recorder(Object.freeze({ ...keystroke }));
        } catch (error) {
            console.warn('[deckit] what records a key threw', error);
        }
    });

    // MARK: - Public
    function forScope(scope, { request }) {
        return Object.freeze({
            take: request(
                'keys.take',
                {
                    guard: PROTOCOL.take.guard,
                    payloadOf: (_keystroke, _run, options) => ({ scope: scopeOf(options) }),
                    signature: TAKES,
                },
                (keystroke, run, options) => take(keystroke, run, options, scope)
            ),
            record: (onKeystroke) => record(onKeystroke, scope),
            list: request('keys.list', { guard: PROTOCOL.list.guard }, () => PROTOCOL.list.invoke()),
            set: request('keys.set', { guard: PROTOCOL.set.guard, signature: SETS }, (id, keystroke) =>
                PROTOCOL.set.invoke({ id, keystroke: keystroke == null ? null : keystrokeOf(keystroke) })
            ),
            reset: request('keys.reset', { guard: PROTOCOL.reset.guard, signature: [['id', 'string']] }, (id) =>
                PROTOCOL.reset.invoke({ id })
            ),
        });
    }

    function activeOf({ request }) {
        return request('active', { guard: PROTOCOL.active.guard }, () => PROTOCOL.active.invoke());
    }

    // MARK: - Private
    // Where a chord taken with `options` works: `app` unless they name a scope.
    function scopeOf(options) {
        return options?.scope ?? 'app';
    }

    // A keystroke as it crosses: each modifier left out is not held.
    function keystrokeOf({ code, meta, control, alt, shift }) {
        return { code, meta: meta ?? false, control: control ?? false, alt: alt ?? false, shift: shift ?? false };
    }

    async function take(keystroke, run, options, scope) {
        const id = ++lastTake;
        runs.set(id, run);
        try {
            const held = await PROTOCOL.take.invoke({ id, keystroke: keystrokeOf(keystroke), scope: scopeOf(options) });
            return Object.freeze({ held, release: scope.add(() => release(id)) });
        } catch (error) {
            runs.delete(id);
            throw error;
        }
    }

    function release(id) {
        if (!runs.delete(id)) return;
        PROTOCOL.release.send({ id });
    }

    // A recording asked again ends the one before it, as main ends it. Refused at call, INVALID_ARGUMENT, for an
    // `onKeystroke` that is no function.
    function record(onKeystroke, scope) {
        if (typeof onKeystroke !== 'function')
            throw REQUEST.refusal('call', 'INVALID_ARGUMENT', 'keys.record: onKeystroke is no function');
        const id = ++lastRecording;
        recorders.clear();
        recorders.set(id, onKeystroke);
        PROTOCOL.record.send({ id });
        return scope.add(() => {
            if (!recorders.delete(id)) return;
            PROTOCOL.stopRecording.send({ id });
        });
    }

    return { forScope, activeOf };
}

export { createKeys };
