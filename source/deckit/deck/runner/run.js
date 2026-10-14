import * as PROTOCOL from './protocol.js';
import * as LOG from '../log/page.js';

// What a mod's page knows of its run: the mod, the run's number main counts it by, and what went wrong with it,
// which main is told as it is recorded.
export function createRun() {
    // MARK: - Property
    const failures = [];
    let mod = null;
    let number = null;

    // MARK: - Initializer
    // MARK: - Public
    // What main answered as the page loaded: the mod's manifest and which run this is.
    function begin(loaded) {
        mod = loaded.manifest;
        number = loaded.run;
    }

    // A throw, or a promise that rejects, is recorded against the mod, never only a console line.
    function deliver(what, listener, ...args) {
        try {
            Promise.resolve(listener(...args)).catch((error) => fail(`${what} threw: ${error.message || error}`));
        } catch (error) {
            fail(`${what} threw: ${error.message || error}`);
        }
    }

    function fail(problem) {
        LOG.warn(`${mod?.id ?? 'a mod'}: ${problem}`);
        failures.push(problem);
        PROTOCOL.problem.send({ run: number, problem: String(problem) });
    }

    // It did not start, and why: what the mods that require it are told.
    function notStarted() {
        PROTOCOL.notStarted.send({ run: number, problem: String(failures.at(-1) || 'it did not start') });
    }

    // MARK: - Private

    return {
        begin,
        deliver,
        fail,
        notStarted,
        get mod() {
            return mod;
        },
        get number() {
            return number;
        },
    };
}
