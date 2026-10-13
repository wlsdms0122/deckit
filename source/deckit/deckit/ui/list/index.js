DeckitModule.define(
    'deckit/ui/list',
    {
        uses: ['deckit/ui/motion'],
        provides: ['list', 'hold', 'heldWhile', 'LEAVING'],
    },
    (MOTION) => {
        // MARK: - Property
        // The mark of a row folding away: it is still drawn, but no longer one of the list's items.
        const LEAVING = 'data-deckit-leaving';
        const waiting = new Map(); // list element -> the change it waits to apply

        // MARK: - Initializer
        // MARK: - Public
        // A list drawn from items by key: the same key keeps the same element, so what the pointer rests on, what has
        // the focus and what plays stay put. `create(item)` makes an element; a kept one is given to `update(element,
        // item)` when there is one, or made again when its item changed. A key names one item. With `animated`, a row
        // added once the list has shown items unfolds along the list's axis, and a removed one folds away. While
        // something in or around the list is held (dragged, renamed) a new set of items waits, and the last one is drawn
        // when it is let go.
        function list({ element = document.createElement('div'), key, create, update = null, animated = false }) {
            const entries = new Map(); // key -> { element, item }
            let shown = false; // whether the list has drawn items: the first ones are there from the start
            const draw = (items) => {
                const kept = new Map();
                const order = [];
                const added = [];
                for (const item of items) {
                    const name = key(item);
                    if (kept.has(name)) throw new Error(`a keyed list was given the key ${name} twice`);
                    let entry = entries.get(name);
                    if (!entry) {
                        entry = { element: create(item), item };
                        added.push(entry.element);
                    } else if (update) update(entry.element, item);
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
                    while (cursor && cursor.hasAttribute?.(LEAVING)) cursor = cursor.nextSibling;
                    if (cursor === node) cursor = cursor.nextSibling;
                    else element.insertBefore(node, cursor);
                }
                if (animated && shown) for (const node of added) MOTION.expand(node, { across: across(element) });
                shown ||= items.length > 0;
            };
            const remove = (node) => {
                if (!animated) return node.remove();
                node.setAttribute(LEAVING, '');
                MOTION.collapse(node, { across: across(element) }, () => node.remove());
            };
            return {
                element,
                set: (items) => {
                    if (busy(element)) waiting.set(element, () => draw(items));
                    else draw(items);
                },
                elementOf: (name) => entries.get(name)?.element || null,
                keyOf: (node) => {
                    for (const [name, entry] of entries) if (entry.element === node) return name;
                    return null;
                },
            };
        }

        // Holds `element` until the returned release runs. Every list it is in or around waits meanwhile.
        function hold(element) {
            element.dataset.deckitHeld = '';
            return () => {
                delete element.dataset.deckitHeld;
                drawWaiting();
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

        // MARK: - Private
        // A list is busy while it, something around it or something in it is held.
        function busy(element) {
            return !!(element.closest('[data-deckit-held]') || element.querySelector('[data-deckit-held]'));
        }

        // Draws what each list waited with, once it is no longer busy. A list taken off the page waits no longer.
        function drawWaiting() {
            for (const [element, draw] of waiting) {
                if (!element.isConnected) waiting.delete(element);
                else if (!busy(element)) {
                    waiting.delete(element);
                    draw();
                }
            }
        }

        // Whether `list` lays its rows across rather than down.
        function across(list) {
            const layout = getComputedStyle(list);
            return layout.display.includes('flex') && layout.flexDirection.startsWith('row');
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

        return { list, hold, heldWhile, LEAVING };
    }
);
