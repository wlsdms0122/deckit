import * as REQUEST from '../../../deckit/request/index.js';

// MARK: - Property
// A web session's name within its mod: a mod names its own sessions, and the environment keeps each apart by the mod
// and this name.
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

// MARK: - Initializer
// MARK: - Public
// Why `name` names no session, or ''.
function nameProblem(name) {
    if (typeof name !== 'string') return `a session's name is a string, not ${typeof name}`;
    return NAME.test(name) ? '' : `${JSON.stringify(name)} is no session's name: ${NAME}`;
}

// The name, as given, when it names a session: refused at call, INVALID_ARGUMENT, otherwise.
function nameOf(name) {
    const problem = nameProblem(name);
    if (problem) throw REQUEST.refusal('call', 'INVALID_ARGUMENT', problem);
    return name;
}

// MARK: - Private

export { NAME, nameProblem, nameOf };
