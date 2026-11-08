// How long a call to the exports opened in start waits for the view: one can come as the mod launches, before attach.
const WITHIN_MS = 2000;

// What attach put on screen for the exports opened in start to reach, `set(screen)` as it does and `set(null)` as it
// goes. `now()` is it or null; `reach()` waits for it a moment, and rejects with why when none comes, `name` the mod's.
function onScreen(name) {
    let screen = null;
    const waiting = new Set();
    return {
        set(given) {
            screen = given;
            if (!given) return;
            for (const resolve of [...waiting]) resolve(given);
        },
        now: () => screen,
        async reach() {
            if (screen) return screen;
            const reached = await new Promise((resolve) => {
                const done = (given) => {
                    clearTimeout(timer);
                    waiting.delete(done);
                    resolve(given);
                };
                const timer = setTimeout(() => done(null), WITHIN_MS);
                waiting.add(done);
            });
            if (!reached) throw new Error(`${name} has no view open`);
            return reached;
        },
    };
}

module.exports = { onScreen };
