// What a main process module finds: whether the window the mod's page is shown in is found, and the pages laid with
// the panel's frame, bottom to top, each by its address, whether it is shown and how wide it is laid.
module.exports = ({ window }) => ({
    found: () => !!window.ofPage(),
    stack() {
        const { BrowserWindow } = require('electron');
        const frame = (view) => view.webContents?.getURL().startsWith('deckit://panel');
        const holder = (view) =>
            (view.children || []).some(frame) ? view : (view.children || []).map(holder).find(Boolean) || null;
        const stage = BrowserWindow.getAllWindows()
            .map((shown) => holder(shown.contentView))
            .find(Boolean);
        return (stage?.children || []).map((view) => ({
            url: view.webContents?.getURL() || '',
            shown: view.getVisible ? view.getVisible() : null,
            width: view.getBounds().width,
        }));
    },
});
