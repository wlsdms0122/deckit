import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as KEY_SCOPE from './model/scope.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createKeymap() {
    // MARK: - Property
    const declaredKeys = new Map(); // name -> { run, scope }
    const listeners = new Set();
    let hearing = null; // the recording under way

    // MARK: - Initializer
    // MARK: - Public
    // A mod's keys, { name: { label, key, scope, run } }, as its run contributes them: `run()` is what pressing it
    // does, here, and the core judges each label and chord, and whether the mod may have its scope, `local` when it
    // names none. One with no function to run or no scope there is, or that `problemOf(entry)`, the shell's reason a
    // key would never run, asked with its scope, refuses, is told to `invalid` and left out.
    function declare(keys, { invalid, problemOf }) {
        const declared = [];
        for (const [name, entry] of Object.entries(keys || {})) {
            if (typeof entry?.run !== 'function') {
                invalid(`key "${name}" cannot be used: it needs a function in "run"`);
                continue;
            }
            const scope = entry.scope ?? 'local';
            if (!KEY_SCOPE.SCOPES.includes(scope)) {
                invalid(`key "${name}" cannot be used: its "scope" is one of ${KEY_SCOPE.SCOPES.join(', ')}`);
                continue;
            }
            const never = problemOf({ ...entry, scope });
            if (never) {
                invalid(`key "${name}" never runs: ${never}`);
                continue;
            }
            declaredKeys.set(name, { run: entry.run, scope });
            declared.push({
                name,
                label: typeof entry.label === 'string' ? entry.label : '',
                key: String(entry.key ?? ''),
                scope,
            });
        }
        return declared;
    }

    // A key pressed in the page while `blocksKeys()` is dropped, so it cannot act on what is behind a dialog; one that
    // works past the page was pressed wherever the person is, and runs. What a key throws is only logged: no one asked
    // to be told.
    function hear({ blocksKeys }) {
        PROTOCOL.key.on(async ({ name }) => {
            const key = declaredKeys.get(name);
            if (!key || (!KEY_SCOPE.isWide(key.scope) && blocksKeys())) return;
            try {
                await key.run();
            } catch (error) {
                console.warn(`[deckit] the key ${name} did not run`, error);
            }
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

    // The chord one of the mod's keys is bound to now, or with `provider`, one that host registered.
    function chord(name, { provider = '' } = {}) {
        return PROTOCOL.chord.invoke({ name: String(name), ...(provider ? { provider } : {}) });
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
