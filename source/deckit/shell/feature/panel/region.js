DeckitModule.define(
    'shell/feature/panel/region',
    {
        uses: ['shell/feature/panel/protocol'],
        provides: ['make'],
        runs: 'page',
    },
    (PROTOCOL) => {
        // MARK: - Property
        const listeners = new Set();
        let children = null; // [{ id, name, icon }]: asked for once the first region is made, then told
        let regions = 0;

        // MARK: - Initializer
        // MARK: - Public
        // A place in the mod's view where the shell shows a child's: a mod whose view names this mod as its parent.
        // The child runs in its own page, laid over `element`'s rect, so what the parent draws there is covered and
        // nothing of the parent's floats over it. `children()` are this mod's, in the person's order; `show(id)` puts
        // one in this region, out of any other it was in, and `clear()` leaves the region empty.
        function make(element) {
            if (element?.nodeType !== Node.ELEMENT_NODE) throw new Error('deck.region() takes an element');
            if (children === null) {
                children = PROTOCOL.children.invoke();
                PROTOCOL.childrenChanged.on(({ children: next }) => {
                    children = next;
                    for (const listener of listeners) listener(children.slice());
                });
            }
            const region = ++regions;
            let placed = '';
            const place = () => {
                const { x, y, width, height } = element.isConnected
                    ? element.getBoundingClientRect()
                    : { x: 0, y: 0, width: 0, height: 0 };
                const rect = { x, y, width, height };
                const written = JSON.stringify(rect);
                if (written === placed) return;
                placed = written;
                PROTOCOL.regionPlace.send({ region, ...rect });
            };
            // Read each frame: an element moves with what is around it (a sidebar folding, a scroll) without resizing.
            const follow = () => {
                place();
                requestAnimationFrame(follow);
            };
            follow();
            return Object.freeze({
                children: () => children.slice(),
                onChange(listener) {
                    listeners.add(listener);
                    return () => listeners.delete(listener);
                },
                show: (id) => PROTOCOL.regionShow.invoke({ region, id: String(id) }),
                clear: () => PROTOCOL.regionShow.invoke({ region, id: null }),
            });
        }

        // MARK: - Private

        return { make };
    }
);
