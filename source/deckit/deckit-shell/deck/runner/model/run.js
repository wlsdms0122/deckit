// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A run of `mod`, the `number`th, as the core last told it: one object for as long as the run lasts, so whatever holds
// it reads it as it is now. `update(told)` takes what the core told of it.
//
// `summary` is what it contributes once running, as a person reads it, and `contributions` what deck joins of it, both
// as its page reported them as it started;
// `problem`, the first one recorded against it while it launches or runs, or why it failed or crashed;
// `relaunches`, whether the runner loads the mod again once it has ended.
function makeRun({ mod, number }) {
    const facts = {
        state: 'launching',
        summary: null,
        contributions: null,
        problem: null,
        relaunches: false,
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
        get relaunches() {
            return facts.relaunches;
        },
    });
    return { run, update: (told) => Object.assign(facts, told) };
}

// MARK: - Private

export { makeRun };
