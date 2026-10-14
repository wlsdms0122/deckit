// The notes folder as the main process module lists it: each folder is { name, path, folders, notes, count }.
function folderAt(top, path) {
    if (!path) return top;
    let folder = top;
    for (const name of path.split('/')) {
        folder = folder.folders.find((child) => child.name === name);
        if (!folder) return null;
    }
    return folder;
}

// Every folder under `top`, each before what it holds, with its depth.
function foldersIn(top, depth = 0) {
    return top.folders.flatMap((folder) => [
        { path: folder.path, name: folder.name, depth },
        ...foldersIn(folder, depth + 1),
    ]);
}

function notesIn(top) {
    return [...top.notes, ...top.folders.flatMap((folder) => notesIn(folder))];
}

module.exports = { folderAt, foldersIn, notesIn };
