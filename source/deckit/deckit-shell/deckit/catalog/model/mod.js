// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A mod as the core gives it: what its manifest says, with `manifest` itself, where it is, its data folder, whether it
// loads, whether it is a system mod (`system`), and `uses`, each interface it uses and what it comes to. `fields` are
// the manifest fields the layers named, by key, each as the manifest writes it, and a permission defined here says
// whether it is `privileged`.
function read(found) {
    return { ...found.manifest, ...found };
}

// MARK: - Private

export { read };
