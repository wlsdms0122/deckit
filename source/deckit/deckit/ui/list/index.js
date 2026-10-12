DeckitModule.define(
    'deckit/ui/list',
    {
        uses: ['deckit/ui/token', 'deckit/ui/motion'],
        provides: ['list', 'hold', 'heldWhile', 'busy', 'freed', 'waiting'],
    },
    (TOKEN, MOTION) => {
        // MARK: - Property
        const waiting = new WeakMap(); // list element -> the change it waits to apply

        // MARK: - Initializer
        // MARK: - Public
        // A list drawn from items by key: the same key keeps the same element, so what the pointer rests on, what has
        // the focus and what plays stay put. `create(item)` makes an element; a kept one is given to `update(element,
        // item)` when there is one, or made again when its item changed. With `exit`, a removed row folds away first.
        // While a row is held (dragged, renamed) a new set of items waits, and the last one is drawn when it is let go.
        function list({ element = document.createElement('div'), key, create, update = null, exit = false }) {
            const entries = new Map(); // key -> { element, item }
            const leaving = new Set();
            const draw = (items) => {
                const kept = new Map();
                const order = [];
                for (const item of items) {
                    const name = key(item);
                    let entry = entries.get(name);
                    if (!entry) entry = { element: create(item), item };
                    else if (update) update(entry.element, item);
                    else if (!same(entry.item, item)) {
                        const made = create(item);
                        entry.element.replaceWith(made);
                        entry.element = made;
                    }
                    entry.item = item;
                    kept.set(name, entry);
                    order.push(entry.element);
                }
                for (const [name, entry] of entries) if (!kept.has(name)) remove(entry.element);
                entries.clear();
                for (const [name, entry] of kept) entries.set(name, entry);
                let cursor = element.firstChild;
                for (const node of order) {
                    while (cursor && leaving.has(cursor)) cursor = cursor.nextSibling;
                    if (cursor === node) cursor = cursor.nextSibling;
                    else element.insertBefore(node, cursor);
                }
            };
            const remove = (node) => {
                if (!exit || !TOKEN.MOTION.fast || !node.getBoundingClientRect().height) return node.remove();
                leaving.add(node);
                collapse(node, () => {
                    leaving.delete(node);
                    node.remove();
                });
            };
            return {
                element,
                set: (items) => {
                    if (busy(element)) waiting.set(element, () => draw(items));
                    else draw(items);
                },
                elementOf: (name) => entries.get(name)?.element || null,
            };
        }

        // Holds `element`, and the lists it is in, until the returned release runs.
        function hold(element) {
            element.dataset.deckitHeld = '';
            return () => {
                delete element.dataset.deckitHeld;
                freed(element);
            };
        }

        // A drag's `begin` that holds `area` from the lift until the drag has played out.
        function heldWhile(area, begin) {
            return (item, down, finished) => {
                const release = hold(area);
                const drag = begin(item, down, () => {
                    release();
                    finished();
                });
                if (!drag) release();
                return drag;
            };
        }

        // A list is busy while a row of it is held or leaving.
        function busy(element) {
            return !!(
                element.matches?.('[data-deckit-held]') ||
                element.querySelector?.('[data-deckit-held], [data-deckit-leaving]')
            );
        }

        // Draws what each list around `element` waited with, once it is no longer busy.
        function freed(element) {
            for (let node = element; node; node = node.parentElement) {
                const draw = waiting.get(node);
                if (!draw || busy(node)) continue;
                waiting.delete(node);
                draw();
            }
        }

        // MARK: - Private
        function collapse(node, then) {
            const length = TOKEN.MOTION.fast;
            const height = node.getBoundingClientRect().height;
            MOTION.play(
                node,
                {
                    transition: 'none',
                    height: height + 'px',
                    minHeight: '0',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                },
                {
                    transition: ['height', 'opacity', 'margin']
                        .map((property) => `${property} ${length}ms ${TOKEN.MOTION.easing}`)
                        .join(', '),
                    height: '0px',
                    opacity: '0',
                    marginTop: '0',
                    marginBottom: '0',
                }
            );
            setTimeout(then, length);
        }

        // Items as plain records: the same when every field is.
        function same(left, right) {
            if (left === right) return true;
            if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
            const keys = Object.keys(left);
            return (
                keys.length === Object.keys(right).length && keys.every((name) => Object.is(left[name], right[name]))
            );
        }

        return { list, hold, heldWhile, busy, freed, waiting };
    }
);
