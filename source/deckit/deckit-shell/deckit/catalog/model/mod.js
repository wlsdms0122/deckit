// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A mod as the core gives it: what its manifest says, with `manifest` itself, where it is, its data folder, whether it
// is a system mod (`system`), `problem`, why it does not load, `{ kind, message }`, `kind` null for a problem that is
// no refusal and `problem` null for a mod that loads, and `uses`, each interface it uses and what it comes to.
// `fields` are the manifest fields the layers named, by key, each as the manifest writes it, and a permission defined
// here says whether it is `privileged`.
function read(found) {
    const { problem = null } = found;
    return {
        ...found.manifest,
        ...found,
        problem: problem && { kind: problem.kind ?? null, message: problem.message },
    };
}

// MARK: - Private

export { read };
