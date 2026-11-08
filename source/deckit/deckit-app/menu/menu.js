// Deckit.app's menu bar: the app's menu, and the Edit menu a text field's keys go through, each item as macOS has it by
// its role. Closing and minimizing a window are the shell's keys, which come after the content, so it has neither.
const TEMPLATE = [
    {
        role: 'appMenu',
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
        ],
    },
    {
        role: 'editMenu',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
        ],
    },
];

function setMenu() {
    const { Menu } = require('electron');
    Menu.setApplicationMenu(Menu.buildFromTemplate(TEMPLATE));
}

module.exports = { setMenu };
