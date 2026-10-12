// The workspaces and tabs open, kept in the records so the next start comes back to them. Not written while restoring:
// a reload mid-restore would come back to only part of the session. A saved workspace or tab that could not come back
// for a reason other than being gone or not being text is unrestored, and kept in every later write until it is opened
// or closed again, so a reload that went wrong never shortens the session.
function savedSession({ records, main, workspaces }) {
    let restoring = true;
    let unrestoredWorkspaces = [];
    const unrestoredTabs = new Map(); // workspace root, or '' for the loose files -> Set of paths

    return { save, restore, forgetUnrestored, reopened, follow };

    function save() {
        if (restoring) return;
        const front = workspaces.front();
        records.set('session', {
            spaces: [
                ...workspaces.all().map((workspace) => ({
                    root: workspace.root,
                    open: savedTabsOf(workspace),
                    active: workspace.current?.path || null,
                    mode: workspace.mode,
                })),
                ...unrestoredWorkspaces.filter(
                    (saved) => !workspaces.all().some((workspace) => sameRoot(workspace, saved))
                ),
            ],
            active: front ? front.root || '' : null,
        });
    }

    // A person may already be asking for things (a file opened from the Finder starts the editor), so what is requested
    // after this begins stays in front.
    async function restore({ openFolder, openInBackground }) {
        const since = workspaces.latestRequest();
        const saved = records.get('session', { spaces: [], active: null });
        try {
            for (const entry of saved.spaces) {
                try {
                    await restoreWorkspace(entry, { since, openFolder, openInBackground });
                } catch (error) {
                    console.warn('[deckit] editor could not bring back a workspace', entry.root, error);
                    unrestoredWorkspaces.push(entry);
                }
            }
            const front = workspaces.all().find((workspace) => (workspace.root || '') === saved.active);
            workspaces.fillIdleFront(front || workspaces.all()[0] || null, undefined, { since });
        } finally {
            restoring = false;
        }
        save();
    }

    // A folder gone is the one way a workspace leaves on its own.
    async function restoreWorkspace(entry, { since, openFolder, openInBackground }) {
        if (entry.root) {
            const status = await main.call('stat', entry.root);
            if (!status.exists) return;
            await openFolder(entry.root, { mode: entry.mode, fromSession: true });
        }
        const unopened = [];
        for (const path of entry.open) {
            const result = await openInBackground(path);
            if (!result.file && result.error?.kind !== 'GONE' && result.error?.kind !== 'NOT_TEXT') unopened.push(path);
        }
        const workspace = entry.root ? workspaces.withRoot(entry.root) : workspaces.loose();
        if (workspace && !(workspace.requestedAt > since))
            workspace.current =
                workspace.files.find((file) => file.path === entry.active) || workspace.files[0] || null;
        if (unopened.length && workspace) unrestoredTabs.set(entry.root || '', new Set(unopened));
        else if (unopened.length) unrestoredWorkspaces.push({ ...entry, open: unopened });
    }

    // A workspace opened or closed again is no longer unrestored.
    function forgetUnrestored(root) {
        unrestoredWorkspaces = unrestoredWorkspaces.filter((saved) => (saved.root || '') !== (root || ''));
        unrestoredTabs.delete(root || '');
    }

    // A file open again, so closing it now takes it out of the session.
    function reopened(workspace, path) {
        unrestoredTabs.get(workspace.root || '')?.delete(path);
    }

    function follow(move) {
        unrestoredWorkspaces = unrestoredWorkspaces
            .map((saved) => ({
                ...saved,
                root: saved.root && move(saved.root),
                open: saved.open.map(move).filter(Boolean),
            }))
            .filter((saved) => saved.root !== null);
        for (const [root, paths] of [...unrestoredTabs]) {
            unrestoredTabs.delete(root);
            const moved = root ? move(root) : root;
            if (moved !== null) unrestoredTabs.set(moved, new Set([...paths].map(move).filter(Boolean)));
        }
    }

    function savedTabsOf(workspace) {
        const unrestored = [...(unrestoredTabs.get(workspace.root || '') || [])];
        return [...workspace.files.map((file) => file.path), ...unrestored.filter((path) => !workspaces.isOpen(path))];
    }

    function sameRoot(workspace, saved) {
        return (workspace.root || '') === (saved.root || '');
    }
}
