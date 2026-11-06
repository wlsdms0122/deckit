// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A run of `mod`, the `number`th, as the core last told it: one object for as long as the run lasts, so whatever holds
// it reads it as it is now. `update(told)` takes what the core told of it.
//
// `summary` is what it contributes once running, as a person reads it, and `contributions` what deck joins of it, both
// as its page reported them as it started;
// `problem`, the first one recorded against it while it launches or runs, or why it failed or crashed;
// `origin`, why it launched (origin.js, or work as the layer that asked for it describes it);
// `failed`, whether it failed or crashed rather than ending as asked or with a mod it requires;
// `relaunchLimited`, whether its mod reached the relaunch limit as it failed, so it loads again only as the person
// opens it;
// `endedWith`, the id of the mod it requires whose end ended it, or null;
// `launchedAt`, when it came to run, in ms since the epoch as this process tells it, or null before;
// `relaunches`, whether the runner loads the mod again once it has ended.
function makeRun({ mod, number, relaunches = false }) {
    const facts = {
        state: 'launching',
        summary: null,
        contributions: null,
        problem: null,
        origin: null,
        failed: false,
        relaunchLimited: false,
        endedWith: null,
        launchedAt: null,
        relaunches,
    };
    const run = Object.freeze({
        mod,
        number,
        get state() {
            return facts.state;
        },
        get summary() {
            return facts.summary;
        },
        get contributions() {
            return facts.contributions;
        },
        get problem() {
            return facts.problem;
        },
        get origin() {
            return facts.origin;
        },
        get failed() {
            return facts.failed;
        },
        get relaunchLimited() {
            return facts.relaunchLimited;
        },
        get endedWith() {
            return facts.endedWith;
        },
        get launchedAt() {
            return facts.launchedAt;
        },
        get relaunches() {
            return facts.relaunches;
        },
    });
    const update = (told) => {
        if (told.state === 'running' && facts.state !== 'running') facts.launchedAt = Date.now();
        Object.assign(facts, told);
    };
    return { run, update };
}

// MARK: - Private

export { makeRun };
