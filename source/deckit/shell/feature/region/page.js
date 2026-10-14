DeckitModule.define(
    'shell/feature/region/page',
    {
        uses: ['shell/feature/region/protocol'],
        provides: ['children', 'make'],
    },
    (PROTOCOL) => {
        // MARK: - Property
        const listeners = new Set();
        let known = null; // [{ id, name, icon }]: asked for once, then told
        let count = 0;
        // The mod's children: the mods whose view names it as their parent. `list()` answers them in the person's
        // order, and `onChange(listener)` hears them each time they change, answering its off.
        const children = Object.freeze({
            list: () => childrenNow().slice(),
            onChange(listener) {
                if (typeof listener !== 'function') throw new Error('onChange() takes a listener function');
                childrenNow();
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        });

        // MARK: - Initializer
        // MARK: - Public
        // A place in the mod's view where the shell shows a child's. The child runs in its own page, laid over
        // `element`'s rect as it moves, so what the parent draws there is covered and nothing of the parent's floats
        // over it. `show(id)` puts a child in this region, out of any other it was in, and `clear()` leaves the region
        // empty. The region ends when its element, once in the page, leaves it.
        function make(element) {
            if (element?.nodeType !== Node.ELEMENT_NODE) throw new Error('deck.region() takes an element');
            const region = ++count;
            let sent = '';
            let entered = false; // a region made in start() has its element in the page only once the view is up
            let ended = false;
            const follow = () => {
                if (!element.isConnected && entered) {
                    ended = true;
                    return PROTOCOL.end.send({ region });
                }
                entered ||= element.isConnected;
                const { x, y, width, height } = element.getBoundingClientRect();
                const written = JSON.stringify([x, y, width, height]);
                if (written !== sent) {
                    sent = written;
                    PROTOCOL.rect.send({ region, x, y, width, height });
                }
                requestAnimationFrame(follow);
            };
            follow();
            return Object.freeze({
                show: (id) => (ended ? refused() : PROTOCOL.show.invoke({ region, id: String(id) })),
                clear: () => (ended ? refused() : PROTOCOL.show.invoke({ region, id: null })),
            });
        }

        // MARK: - Private
        function refused() {
            return Promise.reject(new Error('the region has ended: its element left the page'));
        }

        function childrenNow() {
            if (known === null) {
                known = PROTOCOL.children.invoke();
                PROTOCOL.childrenChanged.on(({ children: next }) => {
                    known = next;
                    for (const listener of listeners) listener(known.slice());
                });
            }
            return known;
        }

        return { children, make };
    }
);
