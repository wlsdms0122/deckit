// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A mod as the core gives it: what its manifest says, with `manifest` itself, where it is, its data folder, whether it
// loads, and `uses`, each interface it uses and what it comes to.
function read(found) {
    return { ...found.manifest, ...found };
}

// MARK: - Private

export { read };
