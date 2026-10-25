const { nameOf } = require('../path/path.js');

// What the Editor adds to the switcher's own list of its commands, through the point `switcher:rows`: New File named
// for the workspace in front, the workspaces and recent folders to go to, and a search of each workspace's files.
function switcher({ ui, util, workspaces, recentFolders }) {
    return { rows };

    function rows() {
        const front = workspaces.front();
        const withFolder = workspaces.all().filter((workspace) => workspace.root);
        return [
            ...(front?.root
                ? [
                      {
                          label: 'New File in ' + nameOf(front.root),
                          icon: ui.icon('filePlus', { size: 16 }),
                          run: { command: 'new-file' },
                      },
                  ]
                : []),
            ...withFolder.map((workspace) => ({
                group: 'Workspaces',
                label: nameOf(workspace.root),
                hint: util.tildify(workspace.root),
                icon: ui.icon('folders', { size: 16 }),
                run: { command: 'open-folder', args: { path: workspace.root } },
            })),
            ...recentFolders().map((path) => ({
                group: 'Recent Folders',
                label: nameOf(path),
                hint: util.tildify(path),
                icon: ui.icon('folder', { size: 16 }),
                run: { command: 'open-folder', args: { path } },
            })),
            ...[...withFolder]
                .sort((left, right) => (right === front) - (left === front))
                .map((workspace) => ({
                    label: 'Search Files in ' + nameOf(workspace.root),
                    hint: util.tildify(workspace.root),
                    icon: ui.icon('search', { size: 16 }),
                    completes: { command: 'open', args: { root: workspace.root }, param: 'path' },
                })),
        ];
    }
}

module.exports = { switcher };
