const { foldersIn } = require('../notes-folder/folder.js');
const { parentOf } = require('../notes-folder/path.js');

// What Notes adds to the switcher's own list of its commands, through the point `switcher:rows`: a search of every
// note, and each folder to go to.
function switcher({ ui, allNotes }) {
    return { rows };

    function rows() {
        return [
            { label: 'Search Notes', completes: { command: 'open', param: 'id' } },
            ...foldersIn(allNotes()).map((folder) => ({
                group: 'Folders',
                label: folder.name,
                hint: parentOf(folder.path),
                icon: ui.icon('folder', { size: 16 }),
                run: { command: 'show-folder', args: { path: folder.path } },
            })),
        ];
    }
}

module.exports = { switcher };
