import * as MOTION from '../motion/index.js';

// MARK: - Property
const waiting = new Map(); // list element -> the change it waits to apply
// The role of an item by the role of what lists it.
const ITEM = Object.freeze({ list: 'listitem', listbox: 'option', tree: 'treeitem', tablist: 'tab' });

// MARK: - Initializer
// MARK: - Public
// A list drawn from items by key: the same key keeps the same element, so what the pointer rests on, what has
// the focus and what plays stay put. `create(item)` makes an element; a kept one is given to `update(element,
// item)` when there is one, or made again when its item changed. A key names one item. With `animated`, a row
// added once the list has shown items fades in; a removed one leaves at once, and the rows after it close up. While
// something in or around the list is held (dragged, renamed) a new set of items waits, and the last one is drawn
// when it is let go. An item made with no role takes the one its list's role gives its items, read as the item is
// made; in a plain list only a row does, as what else is listed there (a card, a control) is read by what it holds.
function list({ element = document.createElement('div'), key, create, update = null, animated = false }) {
    const entries = new Map(); // key -> { element, item }
    let shown = false; // whether the list has drawn items: the first ones are there from the start
    const make = (item) => {
        const made = create(item);
        const role = ITEM[element.getAttribute('role')];
        if (role && !made.hasAttribute('role') && (role !== 'listitem' || made.classList.contains('deckit-row')))
            made.setAttribute('role', role);
        return made;
    };
    const draw = (items) => {
        const kept = new Map();
        const order = [];
        const added = [];
        for (const item of items) {
            const name = key(item);
            if (kept.has(name)) throw new Error(`a keyed list was given the key ${name} twice`);
            let entry = entries.get(name);
            if (!entry) {
                entry = { element: make(item), item };
                added.push(entry.element);
            } else if (update) update(entry.element, item);
            else if (!same(entry.item, item)) {
                const made = make(item);
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
            if (cursor === node) cursor = cursor.nextSibling;
            else element.insertBefore(node, cursor);
        }
        if (animated && shown) for (const node of added) MOTION.appear(node);
        shown ||= items.length > 0;
    };
    const remove = (node) => node.remove();
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

// Whether `list` lays its rows across rather than down.
function across(list) {
    const layout = getComputedStyle(list);
    return layout.display.includes('flex') && layout.flexDirection.startsWith('row');
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

// Items as plain records: the same when every field is.
function same(left, right) {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((name) => Object.is(left[name], right[name]));
}

export { list, hold, heldWhile, across };
