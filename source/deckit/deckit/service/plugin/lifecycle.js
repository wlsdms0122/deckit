DeckitModule.define(
    'deckit/service/plugin/lifecycle',
    {
        uses: [],
        provides: ['NOTIFICATIONS', 'makeRun'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a run tells as it moves, in the order a run that starts and stops tells them.
        const NOTIFICATIONS = ['willLaunch', 'didLaunch', 'didFailToLaunch', 'willTerminate', 'didTerminate'];
        // A run is made notRunning, launches once and ends notRunning. Each transition: the states it leaves, the state
        // it reaches, what it tells. A crash ends a run from any state, with no willTerminate before it.
        const TRANSITIONS = {
            launch: { from: ['notRunning'], to: 'launching', tells: 'willLaunch' },
            didLaunch: { from: ['launching'], to: 'running', tells: 'didLaunch' },
            didFailToLaunch: { from: ['launching'], to: 'notRunning', tells: 'didFailToLaunch' },
            terminate: { from: ['launching', 'running'], to: 'terminating', tells: 'willTerminate' },
            didTerminate: { from: ['terminating'], to: 'notRunning', tells: 'didTerminate' },
            crash: { from: ['launching', 'running', 'terminating'], to: 'notRunning', tells: 'didTerminate' },
        };

        // MARK: - Initializer
        // MARK: - Public
        // One run of `plugin`'s entry, the `number`th, from launching it to its end. `notify(name, run)` is told each
        // transition. A transition from a state it does not leave, or a second launch, throws.
        //
        // `summary` and `exports` are what it contributes once running; `problem`, the first one recorded against it;
        // `endReason`, why it terminated or ended.
        function makeRun({ plugin, number, notify }) {
            const facts = {
                state: 'notRunning',
                launched: false,
                summary: null,
                exports: null,
                problem: null,
                endReason: null,
            };
            const move = (transition, change) => {
                const { from, to, tells } = TRANSITIONS[transition];
                if (!from.includes(facts.state) || (transition === 'launch' && facts.launched))
                    throw new Error(`${plugin.id} run ${number}: ${transition} while ${facts.state}`);
                Object.assign(facts, change, { state: to });
                notify(tells, run);
            };
            const ended = (reason) => ({ endReason: reason, problem: facts.problem ?? reason });
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
                launch: () => move('launch', { launched: true }),
                didLaunch: ({ summary, exports }) => move('didLaunch', { summary, exports }),
                didFailToLaunch: (reason) => move('didFailToLaunch', ended(reason)),
                terminate: (reason) => move('terminate', { endReason: reason }),
                didTerminate: () => move('didTerminate', {}),
                crash: (reason) => move('crash', ended(reason)),
                record: (problem) => (facts.problem ??= problem),
            });
            return run;
        }

        // MARK: - Private

        return { NOTIFICATIONS, makeRun };
    }
);
