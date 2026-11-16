// The clock's item in the status bar: the short date and time in the person's language as its label, set again as
// each minute turns, while `status-bar/items` is connected.
const INTERFACE = 'status-bar/items';
const MINUTE = 60000;
const WRITTEN = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };

function face(deckit) {
    // MARK: - Property
    const format = new Intl.DateTimeFormat(undefined, WRITTEN);
    let bar = null; // the status bar's exports, while connected
    let timer = 0;

    // MARK: - Initializer
    deckit.dependencies.onConnect(INTERFACE, (connected) => {
        bar = connected;
        tell();
        return () => (bar = null);
    });
    write();

    // MARK: - Public
    function end() {
        clearTimeout(timer);
    }

    // MARK: - Private
    // The time now, then again just after the next minute turns, each timer set from the time it writes, so the
    // minute it shows never drifts.
    function write() {
        tell();
        timer = setTimeout(write, MINUTE - (Date.now() % MINUTE) + 50);
    }

    function tell() {
        bar?.set({ label: format.format(Date.now()) }).catch((error) => console.error('[clock] not shown', error));
    }

    return Object.freeze({ end });
}

module.exports = { face };
