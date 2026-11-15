import * as MODEL from './model/status.js';

// How many labels' measured widths are kept: those measured last.
const KEPT = 64;

// The status bar, the shell's own: what its providers give, laid for each seat by the model. A provider inside the
// shell is asked `item(seat)`, the item it gives that seat as plain data (model/status.js heldTo) or null for none,
// and told `press(seat, { row, action })`, a press of the seat's on its item, `row` and `action` null, on a row, on
// a row's close button, `action` 'close', or on an action, `row` null for one of the item's own. It answers a press
// by giving new data and saying it changed. The bar keeps no seat's open popover: the desktop keeps it on the seat's
// hand and hands it in.
export function createStatus() {
    // MARK: - Property
    const providers = []; // what gives the items, in the order they were given
    const standing = new Map(); // seat id -> the ids of the items there for it, in the order they began to be
    const listeners = new Set();
    let widths = {}; // a label's text -> how wide the desktop's page measured it

    // MARK: - Initializer
    // MARK: - Public
    // A provider from now on: answers `{ changed(), end() }`, `changed` to say what it gives is other than it was,
    // `end` to give nothing more.
    function provide({ item, press = () => {} }) {
        const provider = { item, press };
        providers.push(provider);
        changed();
        return Object.freeze({
            changed,
            end: () => {
                const at = providers.indexOf(provider);
                if (at < 0) return;
                providers.splice(at, 1);
                changed();
            },
        });
    }

    // The bar as it is laid for `seat` on `stage` under the host's bar `strip`, `open` the seat's open popover,
    // `{ item, scroll }` or null: `{ items, bar, popover, open }`, the items there in the order they began to be,
    // the bar and the popover as the model lays them, and `open` as it is now, closed where its item went.
    function laid(seat, open, stage, strip) {
        const items = itemsOf(seat).map(({ item }) => item);
        const next = MODEL.settled(open, items, stage, strip);
        const bar = MODEL.barOf(stage, strip, items, widths);
        const item = next && items.find(({ id }) => id === next.item);
        return { items, bar, popover: next && MODEL.popoverOf(stage, strip, bar, item, next.scroll), open: next };
    }

    // A press of `seat` let go on `part` (model partAt), the one it went down on: `{ open, tell }`, the seat's open
    // popover after it, and `tell()`, which tells the item's provider, to be called once that is kept.
    function press(seat, open, part) {
        const given = itemsOf(seat);
        const items = given.map(({ item }) => item);
        const { open: next, tell: told } = MODEL.pressed(open, part, items);
        const provider = told && given.find(({ item }) => item.id === told.item).provider;
        return { open: next, tell: () => provider?.press(seat, { row: told.row, action: told.action }) };
    }

    // The desktop's page measured a label: `{ label, width }`.
    function measured({ label, width }) {
        if (typeof label !== 'string' || !(width > 0) || widths[label] === width) return;
        const kept = Object.entries({ ...widths, [label]: width }).slice(-KEPT);
        widths = Object.fromEntries(kept);
        changed();
    }

    // A seat left: nothing stands for it.
    function leave(seat) {
        standing.delete(seat);
    }

    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    // `[{ item, provider }]`: what each provider gives `seat`, as the frame takes it, the first of an id alone, in the
    // order the items began to be there for the seat.
    function itemsOf(seat) {
        const given = new Map();
        for (const provider of providers) {
            const item = MODEL.heldTo(provider.item(seat));
            if (item && !given.has(item.id)) given.set(item.id, { item, provider });
        }
        const order = MODEL.orderOf(
            standing.get(seat) ?? [],
            [...given.keys()].map((id) => ({ id }))
        );
        standing.set(seat, order);
        return order.map((id) => given.get(id));
    }

    function changed() {
        for (const listener of [...listeners]) listener();
    }

    return Object.freeze({ provide, laid, press, measured, leave, onChange });
}
