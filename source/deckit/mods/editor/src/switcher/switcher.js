const { nameOf } = require('../path/path.js');

// What the Editor adds to the switcher through its point `switcher:actions`: New File named for the workspace in front,
// the workspaces and recent folders to go to, a search of each workspace's files, and what its keys do. Each action's
// value is `{ action, ...args }`, run by `does[action](args, { ready })`; one that opens a search is the value its
// results add an arg to. `filesOf(workspace, query)` answers the files found in one.
function switcher({ ui, util, workspaces, recentFolders, filesOf, show, does }) {
    return { list, search, run };

    function list() {
        const front = workspaces.front();
        const withFolder = workspaces.all().filter((workspace) => workspace.root);
        return [
            ...(front?.root
                ? [
                      {
                          label: 'New File in ' + nameOf(front.root),
                          icon: ui.icon('filePlus', { size: 16 }),
                          keywords: ['새 파일', '파일', '만들기', 'new', 'file', 'create'],
                          value: { action: 'new-file' },
                      },
                  ]
                : []),
            ...withFolder.map((workspace) => ({
                group: 'Workspaces',
                label: nameOf(workspace.root),
                hint: util.tildify(workspace.root),
                icon: ui.icon('folders', { size: 16 }),
                value: { action: 'open-folder', path: workspace.root },
            })),
            ...recentFolders().map((path) => ({
                group: 'Recent Folders',
                label: nameOf(path),
                hint: util.tildify(path),
                icon: ui.icon('folder', { size: 16 }),
                value: { action: 'open-folder', path },
            })),
            ...[...withFolder]
                .sort((left, right) => (right === front) - (left === front))
                .map((workspace) => ({
                    label: 'Search Files in ' + nameOf(workspace.root),
                    hint: util.tildify(workspace.root),
                    icon: ui.icon('search', { size: 16 }),
                    opens: true,
                    value: { action: 'open', root: workspace.root },
                })),
            { label: 'Open Quickly', value: { action: 'open-quickly' } },
            {
                label: 'Go to File',
                keywords: ['파일', '검색', '열기', 'file', 'open', 'quick', 'find', 'workspace'],
                opens: true,
                value: { action: 'open' },
            },
            {
                label: 'Open File…',
                keywords: ['열기', '파일', 'open', 'file'],
                value: { action: 'open-file' },
            },
            {
                label: 'Open Folder…',
                keywords: ['열기', '폴더', '워크스페이스', 'open', 'folder', 'workspace', 'project'],
                value: { action: 'open-folder' },
            },
            { label: 'New Folder', value: { action: 'new-folder' } },
            { label: 'Move to Trash', value: { action: 'trash' } },
            { label: 'Show Files', value: { action: 'show-files' } },
            { label: 'Reveal in Files', value: { action: 'reveal-in-files' } },
            { label: 'Find in Workspace', value: { action: 'find-in-workspace' } },
            { label: 'Previous Tab', value: { action: 'previous-tab' } },
            { label: 'Next Tab', value: { action: 'next-tab' } },
            { label: 'Save', value: { action: 'save' } },
            { label: 'Save All', value: { action: 'save-all' } },
            { label: 'Close File', value: { action: 'close-file' } },
            { label: 'Find in File', value: { action: 'find-in-file' } },
            { label: 'Replace in File', value: { action: 'replace-in-file' } },
            { label: 'Go to Line', value: { action: 'go-to-line' } },
            { label: 'Wrap Lines', value: { action: 'wrap-lines' } },
        ];
    }

    // Inside a search of files, those of its workspace, the one in front where it names none, or null where a newer
    // ranking took the place of this one.
    async function search(query, within) {
        if (within?.action !== 'open') return [];
        const workspace = within.root === undefined ? workspaces.front() : workspaces.withRoot(within.root);
        const found = await filesOf(workspace, query);
        return (
            found && found.map(({ value, title, hint }) => ({ label: title, hint, value: { ...within, path: value } }))
        );
    }

    // An action calls `ready()` once it has found it can be done, and the mod comes to the front then, so a refusal
    // is read under the switcher's list; one whose result goes on elsewhere does not call it.
    async function run({ action, ...args }) {
        await does[action](args, { ready: show });
    }
}

// The actions of `does` done with the mod in front, each ready once its synchronous part, where a refusal throws,
// is past.
function inFront(does) {
    return Object.fromEntries(
        Object.entries(does).map(([name, run]) => [
            name,
            (args, { ready }) => {
                const doing = run(args);
                ready();
                return doing;
            },
        ])
    );
}

module.exports = { switcher, inFront };
