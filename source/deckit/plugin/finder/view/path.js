// The disk's root goes by the name the system gives it.
function displayNameOf(path) {
    return path === '/' ? 'Macintosh HD' : path.split('/').pop() || path;
}

function parentOf(path) {
    return path === '/' ? null : path.slice(0, path.lastIndexOf('/')) || '/';
}

function childOf(folder, name) {
    return folder === '/' ? '/' + name : folder + '/' + name;
}

function isInside(path, folder) {
    return path !== folder && path.startsWith(folder === '/' ? '/' : folder + '/');
}

// The names leading from `folder` down to `path`, which is inside it.
function stepsFrom(folder, path) {
    return path.slice(folder === '/' ? 1 : folder.length + 1).split('/');
}
