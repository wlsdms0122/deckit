import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The chords a mod takes from every page of the app, or from every app too, in its page.
export function createKeymap() {
    // MARK: - Property
    const runs = new Map(); // the id a chord is taken under -> what a press of it runs
    let next = 0;

    // MARK: - Initializer
    // MARK: - Public
    // A press of a chord the mod took runs what it took it with, here. What that throws is only logged: no one asked
    // to be told.
    function hear() {
        PROTOCOL.key.on(async ({ id }) => {
            const run = runs.get(id);
            if (!run) return;
            try {
                await run();
            } catch (error) {
                console.warn('[deckit] what a chord runs threw', error);
            }
        });
    }

    // `keystroke`, `{ code, meta, control, alt, shift }`, `code` as a keyboard event names the key, taken in `scope`:
    // `app`, every page of the app, with deckit.app-keys, or `global`, every app, with system.global-keys. `run()` is
    // what each press does. Resolves to `{ held, release }`: `held` whether it works where its scope says, false for a
    // chord the system did not give, which works in every page of the app still, and `release()` letting it go.
    // Rejects for a chord another mod holds, or a permission the mod does not have.
    async function take(keystroke, run, { scope = 'app' } = {}) {
        if (typeof run !== 'function') throw new Error('a chord is taken with a function to run');
        const { code, meta, control, alt, shift } = keystroke ?? {};
        const id = ++next;
        runs.set(id, run);
        try {
            const held = await PROTOCOL.take.invoke({
                id,
                keystroke: { code: String(code ?? ''), meta: !!meta, control: !!control, alt: !!alt, shift: !!shift },
                scope: String(scope),
            });
            return { held, release: () => release(id) };
        } catch (error) {
            runs.delete(id);
            throw error;
        }
    }

    // MARK: - Private
    function release(id) {
        if (!runs.delete(id)) return;
        PROTOCOL.release.send({ id });
    }

    return { hear, take };
}
