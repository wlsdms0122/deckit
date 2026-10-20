export function createFolder() {
    // MARK: - Property
    const fs = require('fs');
    const path = require('path');

    // MARK: - Initializer
    // MARK: - Public
    // The file a path names inside a mod's folder, where it really is: { file, relative }, `relative` its "/"
    // separated path from the folder. Null for a path that is no file, or that leads out of the folder, by a link
    // too.
    function fileIn(folder, given) {
        try {
            const root = fs.realpathSync(folder);
            const file = fs.realpathSync(path.resolve(root, String(given)));
            const inside = path.relative(root, file);
            if (!inside || inside.split(path.sep)[0] === '..' || path.isAbsolute(inside)) return null;
            if (!fs.statSync(file).isFile()) return null;
            return { file, relative: inside.split(path.sep).join('/') };
        } catch {
            return null;
        }
    }

    // MARK: - Private

    return { fileIn };
}
