// MARK: - Property
// How long a mod reached by id has to open its exports for its id, in milliseconds: one that has not by then did not
// launch, or opens none.
const WITHIN = 10000;

// MARK: - Initializer
// MARK: - Public
// The mods reached by id for work on the exports they open for their id: a mod is reached as work for it begins, which
// launches it if it does not run, and let go as the last work for it ends. `dependencies` is a lifecycle's
// `{ onConnect, reach, release }`.
function reacher(dependencies, { within = WITHIN } = {}) {
    // MARK: - Property
    // Mod id -> { works, exports, waiting, asked }, while work for it is under way: `works` how many, `exports` its
    // while its connection stands, `waiting` what hands them to the works that wait for them, `asked` the reach.
    const held = new Map();
    const listened = new Set(); // the ids onConnect listens for
    const letting = new Map(); // mod id -> its release under way, which a new reach comes after

    // MARK: - Public
    // What `work(exports)` answers, given the exports `id` opens for its id once its connection stands. Rejected with
    // why the mod was not reached: the core's refusal, or kind `NOT_RUNNING` for one that did not stand in time.
    async function using(id, work) {
        const reached = hold(id);
        try {
            return await work(await standing(id, reached));
        } finally {
            letGo(id, reached);
        }
    }

    // MARK: - Private
    function hold(id) {
        let reached = held.get(id);
        if (!reached) {
            reached = { works: 0, exports: null, waiting: new Set(), asked: null };
            held.set(id, reached);
            listen(id);
            reached.asked = (letting.get(id) ?? Promise.resolve()).then(() => dependencies.reach(id));
        }
        reached.works += 1;
        return reached;
    }

    // The connection for `id` hands its exports to the works that wait for it, while work for it is under way.
    function listen(id) {
        if (listened.has(id)) return;
        listened.add(id);
        dependencies.onConnect(id, (exports) => {
            const reached = held.get(id);
            if (!reached) return;
            reached.exports = exports;
            for (const handed of reached.waiting) handed(exports);
            reached.waiting.clear();
            return () => {
                if (reached.exports === exports) reached.exports = null;
            };
        });
    }

    async function standing(id, reached) {
        await reached.asked;
        if (reached.exports) return reached.exports;
        return new Promise((resolve, reject) => {
            const handed = (exports) => {
                clearTimeout(timer);
                resolve(exports);
            };
            const timer = setTimeout(() => {
                reached.waiting.delete(handed);
                const why = `${id} did not open its exports for its id in time: it did not launch, or opens none`;
                reject(Object.assign(new Error(why), { kind: 'NOT_RUNNING' }));
            }, within);
            reached.waiting.add(handed);
        });
    }

    function letGo(id, reached) {
        reached.works -= 1;
        if (reached.works > 0) return;
        held.delete(id);
        const release = reached.asked
            .then(
                () => dependencies.release(id),
                () => {}
            )
            .catch((error) => console.error(`[urls] ${id} was not let go`, error))
            .finally(() => {
                if (letting.get(id) === release) letting.delete(id);
            });
        letting.set(id, release);
    }

    return Object.freeze({ using });
}

module.exports = { reacher, WITHIN };
