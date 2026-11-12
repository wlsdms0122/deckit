// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The mods' app icons as the shell reads them, with `shell.mods.icon(id)`, kept so a row draws its icon at once:
// `read(ids)` asks again for each of `ids`, and `of(id)` answers what was read, or '' (the default icon).
function createIcons(shell) {
    const icons = new Map(); // a mod's id -> its icon

    async function read(ids) {
        const read = await Promise.all(ids.map((id) => shell.mods.icon(id).catch(() => '')));
        ids.forEach((id, index) => icons.set(id, read[index]));
    }

    function of(id) {
        return icons.get(id) ?? '';
    }

    return { read, of };
}

// MARK: - Private

module.exports = { createIcons };
