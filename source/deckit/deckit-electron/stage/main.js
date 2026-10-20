// Where a layer on deckit lays pages in a host app's window: a stage it places in the window, and the pages on it,
// bottom to top, each where it is or hidden. Which pages, in what order and where, is the layer's; how Electron's
// views are added, raised, moved and shown to get there is the stage's. `viewOf(page)` is the view a page is in.
export function createStage({ LOG, WINDOW, viewOf }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function create() {
        const { View } = require('electron');
        // What holds the pages: an Electron view, so a page on the stage is in the window the stage is placed in.
        const container = new View();
        container.setBackgroundColor('#00000000');
        container.setVisible(false);

        // Into one of the host app's windows, as deckit places a view (`front`, `bounds`, `onClose`).
        function place(window, options) {
            WINDOW.place(container, window, options);
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

        // `layers`, bottom to top, are what is on the stage: each `{ page, rect }`, laid there, or `{ page, hidden:
        // true }`, kept in its place unseen. A page left out is taken off. Each is clear where it draws nothing.
        function lay(layers) {
            const wanted = layers.map(({ page, rect = null, hidden = false }) => {
                const view = viewOf(page);
                if (!view) throw new Error("[deckit] a stage lays a page of deck's, or a surface one opened");
                return { view, rect: hidden ? null : rect };
            });
            order(wanted.map(({ view }) => view));
            for (const { view, rect } of wanted) {
                if (rect) view.setBounds(rect);
                view.setVisible(!!rect);
            }
        }

        // MARK: - Private
        // Electron lays a view added last on top, and adding one again lifts it there. So the views already in the
        // order wanted stay, a new one goes in at its place, and only what is out of order from there is lifted, in
        // order: what a lift does to a page is done no more than it must be.
        function order(views) {
            const wanted = new Set(views);
            for (const view of [...container.children]) if (!wanted.has(view)) container.removeChildView(view);
            const children = [...container.children];
            let at = 0;
            let from = views.length;
            for (const [index, view] of views.entries()) {
                const found = children.indexOf(view);
                if (found < 0) {
                    view.setBackgroundColor('#00000000');
                    view.setVisible(false);
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
            for (const view of views.slice(from)) {
                if (!children.includes(view)) {
                    view.setBackgroundColor('#00000000');
                    view.setVisible(false);
                }
                container.addChildView(view);
            }
        }

        return Object.freeze({ place, size, whenResized, show, lay });
    }

    // MARK: - Private

    return { create };
}
