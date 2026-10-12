// Paths are relative to the notes folder: "" is the folder itself, "Release/5.280.md" a note.
function baseName(path) {
    return path.slice(path.lastIndexOf('/') + 1);
}

function parentOf(path) {
    return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function noteName(path) {
    return baseName(path).replace(/\.md$/i, '');
}

function isWithin(path, folder) {
    return path === folder || path.startsWith(folder + '/');
}
