// The clock's view: the short date and time in the person's language, written again as each minute turns, and the
// width it draws told to the status bar as it changes. A press opens or closes the notification center, while
// `notifications/center` is connected, and does nothing while it is not; the item shows pressed while it is open.
const INTERFACE = 'status-bar/items';
const CENTER = 'notifications/center';
const MINUTE = 60000;
const WRITTEN = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };

function face(shell, deckit) {
    // MARK: - Property
    const text = document.createElement('span');
    const item = shell.ui.barItem({ content: text, onClick: press });
    const format = new Intl.DateTimeFormat(undefined, WRITTEN);
    let bar = null; // the status bar's exports, while connected
    let center = null; // the notification center's exports, while connected
    let told = 0; // the width the bar was last told
    let timer = 0;

    // MARK: - Initializer
    shell.view.register({ content: item.element, didAppear: tell });
    deckit.dependencies.onConnect(INTERFACE, (connected) => {
        bar = connected;
        told = 0;
        tell();
        return () => (bar = null);
    });
    deckit.dependencies.onConnect(CENTER, (connected) => {
        center = connected;
        return () => {
            center = null;
            item.setPressed(false);
        };
    });
    deckit.events.on(`${CENTER}:changed`, ({ open }) => item.setPressed(open));
    write();

    // MARK: - Public
    function end() {
        clearTimeout(timer);
    }

    // MARK: - Private
    // The time now, then again just after the next minute turns, each timer set from the time it writes, so the
    // minute it shows never drifts.
    function write() {
        const now = Date.now();
        text.textContent = format.format(now);
        tell();
        timer = setTimeout(write, MINUTE - (now % MINUTE) + 50);
    }

    function press() {
        center
            ?.toggle()
            .then((open) => item.setPressed(open))
            .catch(() => {});
    }

    function tell() {
        const width = item.width();
        if (!bar || !width || width === told) return;
        told = width;
        bar.setWidth(width).catch(() => (told = 0));
    }

    return Object.freeze({ end });
}

module.exports = { face };
