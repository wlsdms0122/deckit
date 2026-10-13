DeckitModule.define(
    'deckit/service/keymap/page',
    {
        uses: ['deckit/module/chord', 'deckit/service/keymap/protocol'],
        provides: ['scope', 'connect', 'chord', 'bindings', 'bind', 'reset', 'record', 'onChange'],
    },
    (CHORD, PROTOCOL) => {
        // MARK: - Property
        const runs = new Map(); // action -> run
        const listeners = new Set();
        let hearing = null; // the recording under way

        // MARK: - Initializer
        // MARK: - Public
        // A plugin's keys, checked once here: { action: { key, label, run, global } }. A global key is taken from every
        // page, fields included, so it needs a modifier and must not be one that edits text. `onScreen`: the plugin has
        // a view, where a key that is not global runs.
        function scope(keys, { invalid, global, onScreen }) {
            const declared = [];
            for (const [action, entry] of Object.entries(keys || {})) {
                const key = entry && CHORD.normalize(entry.key);
                if (!key || typeof entry.run !== 'function') {
                    invalid(`key "${action}" cannot be used: it needs a chord in "key" and a function in "run"`);
                    continue;
                }
                if (entry.global && !global) {
                    invalid(`key "${action}" cannot be global: that takes the system.global-keys permission`);
                    continue;
                }
                if (!entry.global && !onScreen) {
                    invalid(
                        `key "${action}" never runs: a plugin with no view is never on screen, so only a global key does`
                    );
                    continue;
                }
                const chord = CHORD.parse(key);
                if (
                    entry.global &&
                    (!(chord.meta || chord.ctrl || chord.alt) || CHORD.editsText({ ...chord, control: chord.ctrl }))
                ) {
                    invalid(
                        `key "${action}" cannot be global: a global key needs ⌘, ⌃ or ⌥, and none a text field uses`
                    );
                    continue;
                }
                runs.set(action, entry.run);
                declared.push({ action, key, label: entry.label || action, global: !!entry.global });
            }
            PROTOCOL.scope.send({ keys: declared });
        }

        // `layers` is what floats in the page; `deliver` runs a plugin's function and records what it throws.
        function connect({ layers, deliver, dismiss }) {
            layers.onChange((floating) => PROTOCOL.floating.send({ on: floating }));
            // A key waits while something floats, so it cannot act on what is behind a dialog.
            PROTOCOL.key.on(({ action }) => {
                if (!layers.count() && runs.has(action)) deliver(`key ${action}`, runs.get(action));
            });
            // Main took this Escape, so the field never saw it: it is played again as a keydown. A field that handles
            // it keeps the caret; one that does not is left, as a browser would, so the next Escape reaches the page.
            PROTOCOL.escape.on(({ last }) => {
                const top = layers.top();
                if (top) return top.dismiss();
                const field = document.activeElement;
                if (isField(field)) {
                    const handled = !field.dispatchEvent(
                        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
                    );
                    if (!handled && document.activeElement === field) field.blur();
                    return;
                }
                if (last) dismiss();
            });
            PROTOCOL.changed.on(() => {
                for (const listener of listeners) listener();
            });
            PROTOCOL.recorded.on((input) => hearing?.(input));
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

        function chord(id) {
            return PROTOCOL.chord.invoke({ id });
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

        // The next chord typed, for a person setting one: { cancel }, { clear }, a chord, or an error to try again.
        function record(onKey) {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                hearing = null;
                window.removeEventListener('keydown', local, true);
                PROTOCOL.record.send({ on: false });
            };
            const hear = (input) => {
                if (done) return;
                if (input.cancel || CHORD.cancels(input)) {
                    finish();
                    return onKey({ cancel: true });
                }
                if (CHORD.clears(input)) {
                    finish();
                    return onKey({ clear: true });
                }
                const got = CHORD.record(input);
                if (got.pending) return;
                // Main is still recording, so the next keystroke is still this one's.
                if (got.error) return onKey(got);
                finish();
                onKey(got);
            };
            // For a keystroke main did not take; one main takes never reaches the page.
            const local = (event) => {
                event.preventDefault();
                event.stopPropagation();
                hear(CHORD.fromEvent(event));
            };
            hearing = hear;
            window.addEventListener('keydown', local, true);
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

        return { scope, connect, chord, bindings, bind, reset, record, onChange };
    }
);
