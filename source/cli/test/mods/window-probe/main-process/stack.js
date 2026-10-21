// What a main process module finds: whether the window the mod's page is shown in is found, the pages laid with the
// panel's frame, bottom to top, each by its address, whether it is shown and how wide it is laid, and the stages in the
// frame's window, each whether it is shown and the addresses of the pages shown on it.
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
    stages() {
        const { BrowserWindow } = require('electron');
        const frame = (view) => view.webContents?.getURL().startsWith('deckit://panel');
        const holder = (view) => (view.children || []).some((stage) => (stage.children || []).some(frame));
        const around = (view) => (holder(view) ? view : (view.children || []).map(around).find(Boolean) || null);
        const stages = BrowserWindow.getAllWindows()
            .map((shown) => around(shown.contentView))
            .find(Boolean);
        return (stages?.children || []).map((stage) => ({
            shown: stage.getVisible(),
            pages: (stage.children || [])
                .filter((view) => view.getVisible())
                .map((view) => view.webContents?.getURL() || ''),
        }));
    },
});
