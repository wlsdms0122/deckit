import * as CHANNEL from '../channel/index.js';

// A request a mod makes through its handle: it answers a promise, and is refused with an error that carries the stage
// it is refused at, its kind and why.
// MARK: - Property
// MARK: - Initializer
// MARK: - Public
function refusal(stage, kind, message) {
    return Object.assign(new Error(message), { stage, kind });
}

// Why `args` do not fit `signature`, or '': `signature` is the parameters in order, each `[name, kind, keys]`, a kind
// as channel/ kindOf names one or `any`, optional when it ends in `?`, and `keys`, for a table, the signature of its
// keys. An argument undefined or null is one left out, and one past the signature, or a key past the table's, is not
// read.
function argumentProblem(signature, args) {
    for (const [at, [name, written, keys = []]] of signature.entries()) {
        const optional = written.endsWith('?');
        const kind = optional ? written.slice(0, -1) : written;
        const value = args[at];
        if (value === undefined || value === null) {
            if (!optional) return `${name} is left out`;
            continue;
        }
        if (kind !== 'any' && CHANNEL.kindOf(value) !== kind) return `${name} is ${CHANNEL.kindOf(value)}, not ${kind}`;
        const problem = argumentProblem(
            keys.map(([key, ...rest]) => [`${name}.${key}`, ...rest]),
            keys.map(([key]) => value[key])
        );
        if (problem) return problem;
    }
    return '';
}

// The request `name`, which `send(...args)` makes: refused at call with NOT_PERMITTED where `denied` says why the mod
// may not make it, then with INVALID_ARGUMENT where its arguments do not fit `signature`.
function requestOf(name, { denied = '', signature = [] }, send) {
    return (...args) => {
        if (denied) return Promise.reject(refusal('call', 'NOT_PERMITTED', denied));
        const problem = argumentProblem(signature, args);
        if (problem) return Promise.reject(refusal('call', 'INVALID_ARGUMENT', `${name}: ${problem}`));
        return Promise.resolve().then(() => send(...args));
    };
}

// MARK: - Private

export { refusal, argumentProblem, requestOf };
