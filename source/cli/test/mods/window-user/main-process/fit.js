// How the mod's page sits in the window it is shown in: the page's rect in the window's content and the content's
// size, or null while it is in none.
module.exports = ({ window }) => ({
    fit() {
        const shown = window.ofPage();
        if (!shown) return null;
        const rectOf = (view, x, y) => {
            if (view.webContents?.getURL().startsWith('deckit://window-user')) {
                const { width, height } = view.getBounds();
                return { x, y, width, height };
            }
            for (const child of view.children || []) {
                const at = child.getBounds();
                const found = rectOf(child, x + at.x, y + at.y);
                if (found) return found;
            }
            return null;
        };
        const [width, height] = shown.getContentSize();
        return { page: rectOf(shown.contentView, 0, 0), window: { width, height } };
    },
});
