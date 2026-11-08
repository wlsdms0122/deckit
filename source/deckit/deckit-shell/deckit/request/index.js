import * as CHANNEL from '../channel/index.js';

// A request a mod makes through its handle: it answers a promise, and is refused with an error that carries the stage
// it is refused at, its kind and why.
// MARK: - Property
// MARK: - Initializer
// MARK: - Public
function refusal(stage, kind, message) {
    return Object.assign(new Error(message), { stage, kind });
}

// Why `value` is not a value, or '': a value is a string, a finite number, a boolean, or an array or a plain table of
// values. A null is none, as a value left out is.
function valueProblem(value, at = 'the value') {
    if (typeof value === 'string' || typeof value === 'boolean') return '';
    if (typeof value === 'number') return Number.isFinite(value) ? '' : `${at} is ${value}, no value`;
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const problem = valueProblem(value[index], `${at}[${index}]`);
            if (problem) return problem;
        }
        return '';
    }
    const prototype = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    if (prototype !== Object.prototype && prototype !== null) return `${at} is ${CHANNEL.kindOf(value)}, no value`;
    for (const [key, one] of Object.entries(value)) {
        const problem = valueProblem(one, `${at}.${key}`);
        if (problem) return problem;
    }
    return '';
}

// Why `args` do not fit `signature`, or '': `signature` is the parameters in order, each `[name, kind, keys]`, a kind
// as channel/ kindOf names one, `any`, or `value` (valueProblem), optional when it ends in `?`, and `keys`, for a
// table, the signature of its keys. An argument undefined or null is one left out, and one past the signature, or a
// key past the table's, is not read.
function argumentProblem(signature, args) {
    for (const [at, [name, written, keys = []]] of signature.entries()) {
        const optional = written.endsWith('?');
        const kind = optional ? written.slice(0, -1) : written;
        const value = args[at];
        if (value === undefined || value === null) {
            if (!optional) return `${name} is left out`;
            continue;
        }
        if (kind === 'value') {
            const problem = valueProblem(value, name);
            if (problem) return problem;
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

export { refusal, valueProblem, argumentProblem, requestOf };
