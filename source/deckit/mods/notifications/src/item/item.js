const MODEL = require('./model/item.js');

const INTERFACE = 'status-bar/items';

// The mod's item in the status bar, kept from `start`: it tells the bar the record's count as the record changes,
// and asks for attention for a while as a notification arrives. `center` is the record's holder; `end()` stops it.
function item(deckit, center) {
    // MARK: - Property
    let bar = null; // the status bar's exports, while it is connected
    let ids = read(); // the record as last read, the ids newest first
    let rings = false; // whether one arrived a moment ago
    let timer = 0;
    const off = center.onChange(changed);

    // MARK: - Initializer
    deckit.dependencies.onConnect(INTERFACE, (connected) => {
        bar = connected;
        tell();
        return () => (bar = null);
    });

    // MARK: - Public
    function end() {
        off();
        clearTimeout(timer);
        bar = null;
    }

    // MARK: - Private
    function read() {
        return center.list().map(({ id }) => id);
    }

    function changed() {
        const now = read();
        if (MODEL.arrivedOf(ids, now)) ring();
        ids = now;
        tell();
    }

    function ring() {
        rings = true;
        clearTimeout(timer);
        timer = setTimeout(() => {
            rings = false;
            tell();
        }, MODEL.RINGS);
    }

    function tell() {
        bar?.set(MODEL.itemOf(ids.length, rings)).catch((error) =>
            console.error('[notifications] the item is not set', error)
        );
    }

    return Object.freeze({ end });
}

module.exports = { item, INTERFACE };
