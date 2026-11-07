// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The chords the keymap takes through the keys hole, each once, in the scope it wants it in. `keys` is the lifecycle's
// `deckit.keys`, and `press(spec)` what a press of the chord `spec` runs.
function chords(keys, press) {
    // MARK: - Property
    const taken = new Map(); // spec -> { scope, held, release }

    // MARK: - Public
    // The chords taken made `wanted`, spec -> `{ keystroke, scope }`: one no longer wanted, or wanted in another scope,
    // is let go, and one not taken yet is taken. Answers spec -> `{ held }`, whether it works where its scope says, or
    // `{ problem }`, why the hole refused it, which is asked again the next time.
    async function match(wanted) {
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
    return Object.freeze({ match });
}

module.exports = { chords };
