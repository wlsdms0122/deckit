DeckitModule.define(
    'deckit/ui/list',
    {
        uses: ['deckit/ui/token', 'deckit/ui/motion'],
        provides: ['list', 'hold', 'heldWhile', 'LEAVING'],
    },
    (TOKEN, MOTION) => {
        // MARK: - Property
        // The mark of a row folding away: it is still drawn, but no longer one of the list's items.
        const LEAVING = 'data-deckit-leaving';
        const waiting = new Map(); // list element -> the change it waits to apply

        // MARK: - Initializer
        // MARK: - Public
        // A list drawn from items by key: the same key keeps the same element, so what the pointer rests on, what has
        // the focus and what plays stay put. `create(item)` makes an element; a kept one is given to `update(element,
        // item)` when there is one, or made again when its item changed. A key names one item. With `exit`, a removed
        // row folds away along the list's axis. While something in or around the list is held (dragged, renamed) a new
        // set of items waits, and the last one is drawn when it is let go.
        function list({ element = document.createElement('div'), key, create, update = null, exit = false }) {
            const entries = new Map(); // key -> { element, item }
            const draw = (items) => {
                const kept = new Map();
                const order = [];
                for (const item of items) {
                    const name = key(item);
                    if (kept.has(name)) throw new Error(`a keyed list was given the key ${name} twice`);
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
                    while (cursor && cursor.hasAttribute?.(LEAVING)) cursor = cursor.nextSibling;
                    if (cursor === node) cursor = cursor.nextSibling;
                    else element.insertBefore(node, cursor);
                }
            };
            const remove = (node) => {
                if (!exit || !TOKEN.MOTION.fast || !node.getBoundingClientRect().height) return node.remove();
                node.setAttribute(LEAVING, '');
                collapse(element, node, () => node.remove());
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

        // Folds `node` away along the axis `list` lays its rows on.
        function collapse(list, node, then) {
            const length = TOKEN.MOTION.fast;
            const layout = getComputedStyle(list);
            const across = layout.display.includes('flex') && layout.flexDirection.startsWith('row');
            const box = node.getBoundingClientRect();
            const [size, minSize, start, end] = across
                ? ['width', 'minWidth', 'marginLeft', 'marginRight']
                : ['height', 'minHeight', 'marginTop', 'marginBottom'];
            MOTION.play(
                node,
                {
                    transition: 'none',
                    [size]: (across ? box.width : box.height) + 'px',
                    [minSize]: '0',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                },
                {
                    transition: [size, 'opacity', 'margin']
                        .map((property) => `${property} ${length}ms ${TOKEN.MOTION.easing}`)
                        .join(', '),
                    [size]: '0px',
                    opacity: '0',
                    [start]: '0',
                    [end]: '0',
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

        return { list, hold, heldWhile, LEAVING };
    }
);
