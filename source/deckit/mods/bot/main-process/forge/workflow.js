// The bot's workflows on its `default` session. `forge` is the supervisor of the daemons, or `{ problem }` when forge's
// settings do not hold: then every report says so.
module.exports = (forge) => {
    const SESSION = forge.DEFAULT;

    const GRACE = 60 * 1000;

    const dispatch = async (name, inputs, runLimit) => {
        if (forge.problem) throw new Error(forge.problem);
        if (!forge.hasToken(SESSION)) throw new Error("no token for the bot's daemon; start it from Bot · Services");
        const out = await forge.run(
            SESSION,
            ['workflow', 'dispatch', name, '--inputs', JSON.stringify(inputs), '--json'],
            true,
            runLimit + GRACE
        );
        const result = JSON.parse(out);
        if (result.status !== 'ok') {
            const why = result.error && (result.error.message || result.error);
            throw new Error(`${name} ended ${result.status}${why ? ': ' + why : ''}`);
        }
        return result.outputs || {};
    };

    const report = (outputs, slot, name) => {
        const parsed = JSON.parse(outputs[slot] || 'null');
        if (!parsed || parsed.status !== 'ok') throw new Error((parsed && parsed.reason) || `${name} gave no report`);
        return parsed;
    };

    const look = (name, runLimit, changed, read = (parsed) => parsed) => {
        const state = { report: null, checkedAt: null, checking: false, error: forge.problem || null };
        let out = null;
        // While forge's settings do not hold there is nothing to ask, and the report keeps saying why.
        const ask = () => {
            if (forge.problem) return Promise.resolve();
            if (out) return out;
            state.checking = true;
            state.error = null;
            changed();
            out = dispatch(name, { format: 'json' }, runLimit)
                .then((outputs) => {
                    state.report = read(report(outputs, 'report', name));
                    state.checkedAt = Date.now();
                })
                .catch((error) => {
                    state.error = error.message;
                })
                .finally(() => {
                    state.checking = false;
                    out = null;
                    changed();
                });
            return out;
        };
        return { state, look: ask };
    };

    return { dispatch, look };
};
