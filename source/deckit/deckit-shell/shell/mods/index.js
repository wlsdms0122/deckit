// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The mods that load, in the mods' order: of every bundle `mods` lists (what connect answered as `deckit.mods`), those
// it holds no refusal for.
function loaded(mods) {
    return mods.list().filter((mod) => !mod.refusal);
}

// MARK: - Private

export { loaded };
