import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as KEY_SCOPE from './model/scope.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createKeymap() {
    // MARK: - Property
    const declaredKeys = new Map(); // name -> { command, args, scope }
    const listeners = new Set();
    let hearing = null; // the recording under way

    // MARK: - Initializer
    // MARK: - Public
    // A mod's keys, { name: { command, args, label, key, scope } }, as its run contributes them: each runs one of the
    // mod's commands with `args`, and the core judges each chord, that its command is declared and its args fit, and
    // whether the mod may have its scope, `local` when it names none. One with no command or no scope there is, or
    // that `problemOf(entry)`, the shell's reason a key would never run, asked with its scope, refuses, is told to
    // `invalid` and left out.
    function declare(keys, { invalid, problemOf }) {
        const declared = [];
        for (const [name, entry] of Object.entries(keys || {})) {
            if (typeof entry?.command !== 'string' || !entry.command) {
                invalid(`key "${name}" cannot be used: it needs the name of a command in "command"`);
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
            const args = entry.args && typeof entry.args === 'object' ? entry.args : null;
            declaredKeys.set(name, { command: entry.command, args, scope });
            declared.push({
                name,
                command: entry.command,
                ...(args ? { args } : {}),
                key: String(entry.key ?? ''),
                label: typeof entry.label === 'string' ? entry.label : '',
                scope,
            });
        }
        return declared;
    }

    // `run(command, args)` runs one of the mod's commands as a key does. A key pressed in the page while
    // `blocksKeys()` is dropped, so it cannot act on what is behind a dialog; one that works past the page was pressed
    // wherever the person is, and runs.
    function hear({ run, blocksKeys }) {
        PROTOCOL.key.on(({ name }) => {
            const key = declaredKeys.get(name);
            if (key && (KEY_SCOPE.isWide(key.scope) || !blocksKeys())) run(key.command, key.args);
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
