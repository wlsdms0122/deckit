const { seats } = require('./seats/seats.js');

const COMMAND = 'show';
const INTERFACE = 'status-bar/items';

// Who sits at the desktop, in the status bar: an item that is there while a seat sits beside the first or a user
// asks to sit, and under it a view of the asks and the seats. It runs from the start; what it knows of the seats is
// the shell's to tell (`shell.seats`), so its item stands only while a screen does.
class Seats {
    // The status bar's exports, while it is connected.
    bar = null;
    // The item as it is to stand, or null for none, and whether the bar holds one of this mod's.
    item = null;
    given = false;
    // What is on screen, while it is attached.
    view = null;

    start(deckit) {
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id) => {
                    if (id !== COMMAND) throw new Error(`Seats has no command ${id}`);
                    if (!this.view) throw new Error('no screen shows the seats now');
                    this.view.toggle();
                },
            }),
        });
        deckit.dependencies.onConnect(INTERFACE, (connected) => {
            this.bar = connected;
            this.given = false;
            this.tell();
            return () => (this.bar = null);
        });
    }

    attach(shell) {
        this.view = seats(shell, {
            onItem: (item) => {
                this.item = item;
                this.tell();
            },
        });
    }

    detach() {
        this.view?.end();
        this.view = null;
        this.item = null;
        this.tell();
    }

    // The bar holds the item as it is to stand, or none.
    tell() {
        if (!this.bar || (!this.item && !this.given)) return;
        const told = this.item ? this.bar.set(this.item) : this.bar.remove();
        this.given = !!this.item;
        told.catch((error) => console.error('[seats] the item is not shown', error));
    }
}

module.exports = Seats;
