// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A run of `mod`, the `number`th, as the core and its page last told it: one object for as long as the run lasts, so
// whatever holds it reads it as it is now. `update(told)` takes what either told of it.
//
// `summary` is what it contributes once running, as a person reads it, and `contributions` what the runner and the
// layers on it join of it, both as its page last reported them;
// `problem`, the first one recorded against it while it launches or runs, or why it failed or crashed;
// `failed`, whether it failed or crashed rather than ending as asked;
// `refusal`, `{ stage, kind, message }`, what it is refused with at launch once it has ended without launching or its
// mod is at the relaunch limit, or null;
// `launchedAt`, when it came to run, in ms since the epoch as this process tells it, or null before;
// `relaunches`, whether the runner loads the mod again once it has ended.
function makeRun({ mod, number, relaunches = false }) {
    const properties = {
        state: 'launching',
        summary: null,
        contributions: null,
        problem: null,
        failed: false,
        refusal: null,
        launchedAt: null,
        relaunches,
    };
    const run = Object.freeze({
        mod,
        number,
        get state() {
            return properties.state;
        },
        get summary() {
            return properties.summary;
        },
        get contributions() {
            return properties.contributions;
        },
        get problem() {
            return properties.problem;
        },
        get failed() {
            return properties.failed;
        },
        get refusal() {
            return properties.refusal;
        },
        get launchedAt() {
            return properties.launchedAt;
        },
        get relaunches() {
            return properties.relaunches;
        },
    });
    const update = (told) => {
        if (told.state === 'running' && properties.state !== 'running') properties.launchedAt = Date.now();
        Object.assign(properties, told);
    };
    return { run, update };
}

// MARK: - Private

export { makeRun };
