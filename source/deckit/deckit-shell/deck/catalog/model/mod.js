// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A mod as the core gives it, read as deck reads every mod: what its manifest says, with `manifest` itself, and where
// it is, its data folder, whether it loads and what it depends on.
function read(found) {
    return { ...found.manifest, ...found };
}

// Whether `mod` links the mod of `id`: names it in its [dependencies].
function links(mod, id) {
    return Object.hasOwn(mod.dependencies, id);
}

// MARK: - Private

export { read, links };
