function nameOf(path) {
    return path.split('/').pop() || path;
}

// Of an absolute path.
function parentOf(path) {
    return path.slice(0, path.lastIndexOf('/'));
}

function isInside(path, folder) {
    return path.startsWith(folder + '/');
}

// Of a path inside `folder`.
function relativePath(path, folder) {
    return path.slice(folder.length + 1);
}

// Of a relative path: '' for one at the top.
function folderOf(relative) {
    return relative.split('/').slice(0, -1).join('/');
}

module.exports = { nameOf, parentOf, isInside, relativePath, folderOf };
