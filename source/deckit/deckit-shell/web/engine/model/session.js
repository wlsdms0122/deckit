// MARK: - Property
// A web session's name within its mod: a mod names its own sessions, and the environment keeps each apart by the mod
// and this name.
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

// MARK: - Initializer
// MARK: - Public
// The name, as given, when it names a session: a throw otherwise.
function nameOf(name) {
    if (!NAME.test(String(name))) throw new Error('not a session name: ' + name);
    return String(name);
}

// MARK: - Private

export { NAME, nameOf };
