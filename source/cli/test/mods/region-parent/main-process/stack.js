// What a main process module finds of the window the mod's page is shown in: the pages laid with the mod's, bottom
// to top, each by its address, whether it is shown and how wide it is laid.
module.exports = ({ window }) => ({
    stack() {
        const shown = window.ofPage();
        if (!shown) return null;
        const mine = (view) => view.webContents?.getURL().startsWith('deckit://region-parent.mod');
        const holder = (view) =>
            (view.children || []).some(mine) ? view : (view.children || []).map(holder).find(Boolean) || null;
        const stage = holder(shown.contentView);
        return (stage?.children || []).map((view) => ({
            url: view.webContents?.getURL() || '',
            shown: view.getVisible ? view.getVisible() : null,
            width: view.getBounds().width,
        }));
    },
});
