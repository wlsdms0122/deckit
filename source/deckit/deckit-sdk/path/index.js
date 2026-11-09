// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A path as it is shown: under `home`, from `~`.
function tildify(path, home) {
    return path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path;
}

// `to` null means gone: a path at or inside `from` becomes null. Paths are "/" separated.
function movePath(path, from, to) {
    if (typeof path !== 'string' || (path !== from && !path.startsWith(from + '/'))) return path;
    return to == null ? null : to + path.slice(from.length);
}

// MARK: - Private

export { tildify, movePath };
