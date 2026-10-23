import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createKeymap() {
    // MARK: - Property
    const runs = new Map(); // action -> run
    const listeners = new Set();
    let hearing = null; // the recording under way

    // MARK: - Initializer
    // MARK: - Public
    // A mod's keys, { action: { key, label, run, global } }, as its run contributes them: the core judges each chord.
    // One with no function to run, or that `problemOf(entry)`, the shell's reason a key would never run, refuses, is
    // told to `invalid` and left out.
    function declare(keys, { invalid, problemOf }) {
        const declared = [];
        for (const [action, entry] of Object.entries(keys || {})) {
            if (typeof entry?.run !== 'function') {
                invalid(`key "${action}" cannot be used: it needs a function in "run"`);
                continue;
            }
            const never = problemOf(entry);
            if (never) {
                invalid(`key "${action}" never runs: ${never}`);
                continue;
            }
            runs.set(action, entry.run);
            declared.push({
                action,
                key: String(entry.key ?? ''),
                label: typeof entry.label === 'string' ? entry.label : '',
                global: !!entry.global,
            });
        }
        return declared;
    }

    // `deliver` runs a mod's function and records what it throws. A key pressed while `blocksKeys()` is dropped,
    // so it cannot act on what is behind a dialog.
    function hear({ deliver, blocksKeys }) {
        PROTOCOL.key.on(({ action }) => {
            if (!blocksKeys() && runs.has(action)) deliver(`key ${action}`, runs.get(action));
        });
        PROTOCOL.changed.on(() => {
            for (const listener of listeners) listener();
        });
        PROTOCOL.recorded.on((recorded) => hearing?.(recorded));
        // Later: during focusout the field losing focus is still the active element.
        let typing = false;
        const tell = () =>
            setTimeout(() => {
                const now = isField(document.activeElement);
                if (now === typing) return;
                typing = now;
                PROTOCOL.typing.send({ on: now });
            });
        document.addEventListener('focusin', tell);
        document.addEventListener('focusout', tell);
    }

    // The chord one of the mod's keys is bound to now, or with `app`, one the app registered.
    function chord(action, { app = false } = {}) {
        return PROTOCOL.chord.invoke({ action: String(action), app });
    }

    function bindings() {
        return PROTOCOL.bindings.invoke();
    }

    function bind(id, spec) {
        return PROTOCOL.bind.invoke({ id, spec: String(spec || '') });
    }

    function reset(id) {
        return PROTOCOL.reset.invoke({ id });
    }

    // The next chord typed, for a person setting one: { cancel }, { clear }, { spec }, or { error } to try again.
    // Main takes every keystroke while it records, so none reaches the page.
    function record(onKey) {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            hearing = null;
            PROTOCOL.record.send({ on: false });
        };
        hearing = (recorded) => {
            if (done || recorded.pending) return;
            // Main is still recording, so the next keystroke is still this one's.
            if (recorded.error) return onKey(recorded);
            finish();
            onKey(recorded);
        };
        PROTOCOL.record.send({ on: true });
        return finish;
    }

    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    function isField(element) {
        return !!element?.matches?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
    }

    return { declare, hear, chord, bindings, bind, reset, record, onChange };
}
