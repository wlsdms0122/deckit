import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// `shell.keys` in a mod's page, its channels bound with `channels`. `forScope(scope, { changes })` answers it for a
// lifecycle: `record(onKeystroke) -> stop` hands `onKeystroke(keystroke)`, `{ code, meta, control, alt, shift }`,
// each key pressed in the page, taken from it, until `stop()`, the next record or the end of `scope`. With `changes`,
// for a mod with deckit.shell-keys, `list()` answers the shell's keys, `[{ id, name, defaultKeystroke, keystroke }]`,
// at once; `set(id, keystroke)` gives one a chord, `{ code, meta, control, alt, shift }`, or none for null, and
// `reset(id)` its default again, each resolving to the key as kept.
function createKeys({ channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const recorders = new Map(); // the id a recording is asked under -> what it hands each key to
    let next = 0;

    // MARK: - Initializer
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
    function forScope(scope, { changes }) {
        return Object.freeze({
            record: (onKeystroke) => record(onKeystroke, scope),
            ...(changes
                ? {
                      list: () => PROTOCOL.list.invoke(),
                      set: (id, keystroke) => PROTOCOL.set.invoke({ id: String(id), keystroke: keystroke ?? null }),
                      reset: (id) => PROTOCOL.reset.invoke({ id: String(id) }),
                  }
                : {}),
        });
    }

    // MARK: - Private
    // A recording asked again ends the one before it, as main ends it.
    function record(onKeystroke, scope) {
        if (typeof onKeystroke !== 'function') throw new Error('shell.keys.record() takes a function');
        const id = ++next;
        recorders.clear();
        recorders.set(id, onKeystroke);
        PROTOCOL.record.send({ id });
        return scope.add(() => {
            if (!recorders.delete(id)) return;
            PROTOCOL.stopRecording.send({ id });
        });
    }

    return { forScope };
}

export { createKeys };
