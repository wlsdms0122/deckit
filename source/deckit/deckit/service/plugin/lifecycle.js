DeckitModule.define(
    'deckit/service/plugin/lifecycle',
    {
        uses: [],
        provides: ['NOTIFICATIONS', 'launch'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a run tells as it moves, in the order a run that starts and stops tells them.
        const NOTIFICATIONS = ['willLaunch', 'didLaunch', 'didFailToLaunch', 'willTerminate', 'didTerminate'];
        // A run launches as it is made and ends notRunning. Each transition: the states it leaves, the state it
        // reaches, what it tells. A launch that fails ends as any run does, its stop() asked while it terminates. A
        // crash ends a run from any state, with no willTerminate before it.
        const TRANSITIONS = {
            didLaunch: { from: ['launching'], to: 'running', tells: 'didLaunch' },
            didFailToLaunch: { from: ['launching'], to: 'terminating', tells: 'didFailToLaunch' },
            terminate: { from: ['launching', 'running'], to: 'terminating', tells: 'willTerminate' },
            didTerminate: { from: ['terminating'], to: 'notRunning', tells: 'didTerminate' },
            crash: { from: ['launching', 'running', 'terminating'], to: 'notRunning', tells: 'didTerminate' },
        };
        // Why a run terminates, weakest first: a stronger reason given while it terminates takes the place of a weaker
        // one. `relaunches`: the plugin launches again once the run has ended.
        const REASONS = {
            restart: { relaunches: true },
            updated: { relaunches: true },
            removed: { relaunches: false },
            quit: { relaunches: false },
        };
        const STRENGTH = Object.keys(REASONS);

        // MARK: - Initializer
        // MARK: - Public
        // One run of `plugin`'s entry, the `number`th, launching: `notify(name, run)` is told willLaunch, and then each
        // transition. A transition from a state it does not leave, or a reason the lifecycle does not have, throws.
        //
        // `summary` and `exports` are what it contributes once running; `problem`, the first one recorded against it
        // while it launches or runs, or why it failed or crashed; `endReason`, the reason it terminated for.
        function launch({ plugin, number, notify }) {
            const facts = { state: 'launching', summary: null, exports: null, problem: null, endReason: null };
            const move = (transition, change) => {
                const { from, to, tells } = TRANSITIONS[transition];
                if (!from.includes(facts.state))
                    throw new Error(`${plugin.id} run ${number}: ${transition} while ${facts.state}`);
                Object.assign(facts, change, { state: to });
                notify(tells, run);
            };
            const failed = (problem) => ({ problem: facts.problem ?? problem });
            const run = Object.freeze({
                plugin,
                number,
                get state() {
                    return facts.state;
                },
                get summary() {
                    return facts.summary;
                },
                get exports() {
                    return facts.exports;
                },
                get problem() {
                    return facts.problem;
                },
                get endReason() {
                    return facts.endReason;
                },
                get relaunches() {
                    return REASONS[facts.endReason]?.relaunches ?? false;
                },
                didLaunch: ({ summary, exports }) => move('didLaunch', { summary, exports }),
                didFailToLaunch: (problem) => move('didFailToLaunch', failed(problem)),
                terminate(reason) {
                    if (!Object.hasOwn(REASONS, reason)) throw new Error(`no terminate reason ${reason}`);
                    if (facts.state !== 'terminating') return move('terminate', { endReason: reason });
                    if (STRENGTH.indexOf(reason) > STRENGTH.indexOf(facts.endReason)) facts.endReason = reason;
                },
                didTerminate: () => move('didTerminate', {}),
                crash: (problem) => move('crash', failed(problem)),
                record(problem) {
                    if (facts.state === 'launching' || facts.state === 'running') facts.problem ??= problem;
                },
            });
            notify('willLaunch', run);
            return run;
        }

        // MARK: - Private

        return { NOTIFICATIONS, launch };
    }
);
