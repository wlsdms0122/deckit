// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The chords the keymap takes through the keys of the shell's handle, each once, in the scope it wants it in, once
// `use` has handed them. `press(spec)` is what a press of the chord `spec` runs.
function chords(press) {
    // MARK: - Property
    const taken = new Map(); // spec -> { scope, held, release }
    let keys = null; // `shell.keys`, once handed

    // MARK: - Public
    // `handed`, the screen lifecycle's `shell.keys`, takes the chords from the next match on, or null takes none. The
    // chords the keys handed before took are the shell's to let go as that lifecycle ends.
    function use(handed) {
        keys = handed;
        taken.clear();
    }

    // The chords taken made `wanted`, spec -> `{ keystroke, scope }`: one no longer wanted, or wanted in another scope,
    // is let go, and one not taken yet is taken. Answers spec -> `{ held }`, whether it works where its scope says, or
    // `{ problem }`, why the shell refused it, which is asked again the next time. Before `use`, it takes none and
    // answers no spec.
    async function match(wanted) {
        if (!keys) return new Map();
        for (const [spec, one] of taken) {
            if (wanted.get(spec)?.scope === one.scope) continue;
            taken.delete(spec);
            one.release();
        }
        const outcomes = new Map();
        for (const [spec, { keystroke, scope }] of wanted) {
            if (!taken.has(spec)) {
                try {
                    const { held, release } = await keys.take(keystroke, () => press(spec), { scope });
                    taken.set(spec, { scope, held, release });
                } catch (error) {
                    outcomes.set(spec, { problem: error.message || String(error) });
                    continue;
                }
            }
            outcomes.set(spec, { held: taken.get(spec).held });
        }
        return outcomes;
    }

    // MARK: - Private
    return Object.freeze({ use, match });
}

module.exports = { chords };
