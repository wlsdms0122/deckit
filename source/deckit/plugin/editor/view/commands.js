// The editor's commands in the command palette: opening, the workspaces and recent folders, and a search of each
// workspace's files.
function paletteCommands({
    ui,
    host,
    util,
    workspaces,
    recentFolders,
    quickOpener,
    onPickFolder,
    onPickFiles,
    onCreateFile,
    onSwitch,
    onOpenFolder,
    onOpen,
}) {
    const front = workspaces.front();
    const withFolder = workspaces.all().filter((workspace) => workspace.root);
    const shown = (run) => () => {
        host.show();
        run();
    };
    return [
        {
            label: 'Open Folder…',
            icon: ui.icon('folder', { size: 16 }),
            keywords: ['열기', '폴더', '워크스페이스', 'open', 'folder', 'workspace', 'project'],
            run: shown(onPickFolder),
        },
        {
            label: 'Open File…',
            icon: ui.icon('fileText', { size: 16 }),
            keywords: ['열기', '파일', 'open', 'file'],
            run: shown(onPickFiles),
        },
        ...(front?.root
            ? [
                  {
                      label: 'New File in ' + nameOf(front.root),
                      icon: ui.icon('filePlus', { size: 16 }),
                      keywords: ['새 파일', '파일', '만들기', 'new', 'file', 'create'],
                      run: shown(onCreateFile),
                  },
              ]
            : []),
        ...withFolder.map((workspace) => ({
            group: 'Workspaces',
            label: nameOf(workspace.root),
            hint: util.tildify(workspace.root),
            icon: ui.icon('folders', { size: 16 }),
            keywords: ['워크스페이스', 'workspace'],
            address: workspace.root,
            run: shown(() => onSwitch(workspace)),
        })),
        ...recentFolders().map((path) => ({
            group: 'Recent Folders',
            label: nameOf(path),
            hint: util.tildify(path),
            icon: ui.icon('folder', { size: 16 }),
            keywords: ['폴더', 'folder'],
            address: path,
            run: shown(() => onOpenFolder(path)),
        })),
        ...[...withFolder]
            .sort((left, right) => (right === front) - (left === front))
            .map((workspace) => ({
                label: 'Search Files in ' + nameOf(workspace.root),
                hint: util.tildify(workspace.root),
                icon: ui.icon('search', { size: 16 }),
                keywords: [
                    '파일',
                    '검색',
                    '열기',
                    'file',
                    'open',
                    'quick',
                    'find',
                    'workspace',
                    nameOf(workspace.root),
                ],
                page: {
                    placeholder: 'Search files in ' + nameOf(workspace.root),
                    search: (query) => searchFiles(workspace, query),
                },
            })),
    ];

    async function searchFiles(workspace, query) {
        let listing;
        try {
            listing = await workspaces.listFiles(workspace);
        } catch (error) {
            return [{ label: 'Could not list the files', hint: error.message, icon: ui.icon('search', { size: 16 }) }];
        }
        return (await quickOpener.rank(listing.files, query)).map((relative) => ({
            label: nameOf(relative),
            hint: relative.split('/').slice(0, -1).join('/') || nameOf(workspace.root),
            icon: fileIconOf(ui, relative, 16),
            run: shown(() => {
                onSwitch(workspace);
                onOpen(workspace.root + '/' + relative);
            }),
        }));
    }
}
