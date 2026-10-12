// The workspaces and the files open in them. A path is open once or not at all; a workspace only lists which of the open
// files are its tabs, and the workspace with no folder holds the files opened on their own. Each request to bring
// something to the front takes the next number, and the workspace it brought forward keeps it (`requestedAt`), so an
// open that took long gives way to anything requested after it. A released file is handed to `onRelease` to take down.
function workspaceModel({ main, onRelease }) {
    const list = [];
    const openFiles = new Map(); // path -> open file
    const foldersByListing = new WeakMap();
    let front = null;
    let requests = 0;

    return {
        all: () => list,
        front: () => front,
        current: () => front?.current || null,
        files: () => [...openFiles.values()],
        fileAt: (path) => openFiles.get(path),
        isOpen: (path) => openFiles.has(path),
        filesUnder,
        withRoot: (root) => list.find((workspace) => workspace.root === root),
        loose: () => list.find((workspace) => !workspace.root),
        ownerOf,
        holderOf,
        add,
        remove,
        reorder,
        place,
        release,
        move,
        gather,
        request,
        latestRequest: () => requests,
        bringToFront,
        fillIdleFront,
        listFiles,
        foldersOf,
    };

    function filesUnder(path) {
        return [...openFiles.values()].filter((file) => file.path === path || isInside(file.path, path));
    }

    function ownerOf(file) {
        return list.find((workspace) => workspace.files.includes(file));
    }

    // The deepest open folder that holds `path`, or else the workspace of loose files.
    function holderOf(path) {
        const holding = list
            .filter((workspace) => workspace.root && isInside(path, workspace.root))
            .sort((left, right) => right.root.length - left.root.length)[0];
        return holding || list.find((workspace) => !workspace.root) || null;
    }

    function add(root, { mode = 'files' } = {}) {
        const workspace = {
            root,
            files: [],
            current: null,
            listing: null,
            mode,
            tree: null,
            search: null,
            requestedAt: 0,
        };
        list.push(workspace);
        return workspace;
    }

    // Not counted as a request: when a person closed it, the closer counts it.
    function remove(workspace) {
        const index = list.indexOf(workspace);
        if (index < 0) return;
        list.splice(index, 1);
        if (front === workspace) fillIdleFront(list[Math.min(index, list.length - 1)] || null);
    }

    // `workspace` goes where `toWorkspace` is.
    function reorder(workspace, toWorkspace) {
        const from = list.indexOf(workspace);
        const to = list.indexOf(toWorkspace);
        if (from < 0 || to < 0) return;
        list.splice(to, 0, list.splice(from, 1)[0]);
    }

    // Every open, close and replaced preview goes through place and release, so the open files and the workspaces'
    // tabs never disagree.
    function place(file, index) {
        const workspace = holderOf(file.path) || add(null);
        const at = index == null ? workspace.files.length : Math.min(index, workspace.files.length);
        workspace.files.splice(at, 0, file);
        openFiles.set(file.path, file);
        return workspace;
    }

    function release(file) {
        const workspace = ownerOf(file);
        if (!workspace) return null;
        unlist(workspace, file);
        openFiles.delete(file.path);
        onRelease(file);
        if (!workspace.root && !workspace.files.length) remove(workspace);
        return workspace;
    }

    function move(file, path) {
        openFiles.delete(file.path);
        file.path = path;
        openFiles.set(path, file);
    }

    // The open files inside `workspace`'s folder move into it; one in front keeps the front, with its request.
    function gather(workspace) {
        for (const from of list.filter((other) => other !== workspace)) {
            for (const file of from.files.filter((other) => holderOf(other.path) === workspace)) {
                const inFront = front === from && from.current === file;
                unlist(from, file);
                workspace.files.push(file);
                if (inFront) {
                    front = workspace;
                    workspace.current = file;
                    workspace.requestedAt = from.requestedAt;
                } else if (!workspace.current) workspace.current = file;
            }
        }
    }

    function unlist(workspace, file) {
        const index = workspace.files.indexOf(file);
        workspace.files.splice(index, 1);
        if (workspace.current === file)
            workspace.current = workspace.files[Math.min(index, workspace.files.length - 1)] || null;
    }

    function request() {
        requests += 1;
        return requests;
    }

    // A request: `workspace` comes to the front, with `file` as its current one when given.
    function bringToFront(workspace, file) {
        request();
        front = workspace;
        if (!workspace) return;
        workspace.requestedAt = requests;
        if (file !== undefined) workspace.current = file;
    }

    // For what nobody requested: `workspace` takes only an empty front, or one nothing was requested into since `since`.
    // Not counted, which would pass by what a person is still waiting for.
    function fillIdleFront(workspace, file, { since } = {}) {
        const idle = !front || !list.includes(front) || (since !== undefined && !(front.requestedAt > since));
        if (idle) front = workspace;
        if (workspace && file !== undefined && !workspace.current) workspace.current = file;
    }

    // Listing a big repository takes a moment, so the listing is kept until it is asked for `fresh`.
    function listFiles(workspace, fresh = false) {
        if (!workspace?.root) return null;
        if (fresh || !workspace.listing) {
            const listing = main.call('files', workspace.root, { fresh });
            workspace.listing = listing;
            listing.catch(() => {
                if (workspace.listing === listing) workspace.listing = null;
            });
        }
        return workspace.listing;
    }

    function foldersOf(listed) {
        if (!listed) return [];
        if (!foldersByListing.has(listed)) {
            const found = new Set();
            for (const relative of listed.files)
                for (let slash = relative.indexOf('/'); slash > 0; slash = relative.indexOf('/', slash + 1))
                    found.add(relative.slice(0, slash));
            foldersByListing.set(listed, [...found].sort());
        }
        return foldersByListing.get(listed);
    }
}
