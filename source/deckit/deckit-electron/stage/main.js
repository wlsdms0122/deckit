// Where a layer on deckit lays pages in a host app's window: a stage it places in the window, and the pages on it,
// each where it is or hidden. Which pages, in what order and where, is the layer's; how Electron's views are added,
// lifted, moved and shown to get there is the stage's. `viewOf(page)` is the view a page of deck's is in.
export function createStage({ LOG, WINDOW, viewOf }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function stage() {
        const { View } = require('electron');
        // What holds the pages: an Electron view, so a page on the stage is in the window the stage is placed in.
        const container = new View();
        container.setBackgroundColor('#00000000');
        container.setVisible(false);
        // The page laid -> the view it was laid in, so a page whose run has moved on is still found to be taken off.
        const laid = new Map();

        // Into one of the host app's windows, as deckit places a view: `bounds`, a rect or a function of the window's
        // content size; `front`, over what is in the window already; `onClose()`, once it is out of a closing window.
        function place(window, { bounds = null, front = false, onClose = null } = {}) {
            WINDOW.place(container, window, { bounds, front, onClose: onClose && (() => onClose()) });
        }

        // The stage's size, as it is laid in its window.
        function size() {
            const { width, height } = container.getBounds();
            return { width, height };
        }

        // Heard each time the stage changes size: answers its off.
        function whenResized(listener) {
            const guarded = LOG.guard(container, 'bounds-changed', () => listener());
            return () => container.removeListener('bounds-changed', guarded);
        }

        function show(on) {
            container.setVisible(!!on);
        }

        // What is on the stage: each layer `{ page, rect }`, laid there, or `{ page, hidden: true }`, unseen. The
        // pages laid are in the order given, bottom to top; a hidden one keeps the place it has, and a new one goes in
        // over the layer before it. A page left out, or whose page is gone, is taken off. Each is clear where it draws
        // nothing.
        function lay(layers) {
            const wanted = [];
            for (const layer of layers) {
                const { page, rect = null, hidden = false } = layer;
                if (!rect === !hidden) throw new Error('[deckit] a layer is { page, rect } or { page, hidden: true }');
                const view = viewOf(page) || laid.get(page);
                if (!view) throw new Error("[deckit] a stage lays a page of deck's, or a surface one opened");
                // A destroyed view may have no webContents left to ask.
                if (!view.webContents || view.webContents.isDestroyed()) {
                    LOG.info('a page laid on a stage is gone: it is taken off');
                    continue;
                }
                wanted.push({ page, view, rect: hidden ? null : rect });
            }
            const views = new Set(wanted.map(({ view }) => view));
            for (const [page, view] of laid) {
                if (views.has(view)) continue;
                laid.delete(page);
                container.removeChildView(view);
            }
            for (const [index, { page, view, rect }] of wanted.entries()) {
                if (!laid.has(page)) {
                    view.setBackgroundColor('#00000000');
                    view.setVisible(false);
                    if (!rect) container.addChildView(view, overOf(wanted.slice(0, index)));
                }
                laid.set(page, view);
            }
            order(wanted.filter(({ rect }) => rect).map(({ view }) => view));
            for (const { view, rect } of wanted) {
                if (rect) view.setBounds(rect);
                view.setVisible(!!rect);
            }
        }

        // MARK: - Private
        // Where a view goes in just over the nearest of `below` already on the stage, or at the bottom.
        function overOf(below) {
            const children = container.children;
            for (const { view } of [...below].reverse()) {
                const at = children.indexOf(view);
                if (at >= 0) return at + 1;
            }
            return 0;
        }

        // Electron lays a view added last on top, and adding one again lifts it there. So the views laid that are
        // already in the order given stay, a new one goes in just over the one before it, and from the first out of
        // order on, each is lifted, in order. The pages hidden between them do not count.
        function order(views) {
            const children = [...container.children];
            let at = 0;
            let from = views.length;
            for (const [index, view] of views.entries()) {
                const found = children.indexOf(view);
                if (found < 0) {
                    container.addChildView(view, at);
                    children.splice(at, 0, view);
                    at++;
                } else if (found >= at) {
                    at = found + 1;
                } else {
                    from = index;
                    break;
                }
            }
            for (const view of views.slice(from)) container.addChildView(view);
        }

        return Object.freeze({ place, size, whenResized, show, lay });
    }

    // MARK: - Private

    return { stage };
}
