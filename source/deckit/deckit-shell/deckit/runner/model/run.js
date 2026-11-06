// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A run of `mod`, the `number`th, as the core and its page last told it: one object for as long as the run lasts, so
// whatever holds it reads it as it is now. `update(told)` takes what either told of it.
//
// `summary` is what it contributes once running, as a person reads it, and `contributions` what the layers on deck and
// deck join of it, both as its page last reported them;
// `problem`, the first one recorded against it while it launches or runs, or why it failed or crashed;
// `failed`, whether it failed or crashed rather than ending as asked;
// `relaunchLimited`, whether its mod reached the relaunch limit as it failed, so it launches again only as its launch
// is asked;
// `launchedAt`, when it came to run, in ms since the epoch as this process tells it, or null before;
// `relaunches`, whether the runner loads the mod again once it has ended.
function makeRun({ mod, number, relaunches = false }) {
    const facts = {
        state: 'launching',
        summary: null,
        contributions: null,
        problem: null,
        failed: false,
        relaunchLimited: false,
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
        get failed() {
            return facts.failed;
        },
        get relaunchLimited() {
            return facts.relaunchLimited;
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
