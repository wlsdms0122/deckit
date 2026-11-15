import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/seats/protocol.js';
import * as ROSTER from './model/roster.js';

// `deckit` is what connect answered, and `DESKTOP` the desktop, whose `seats` knows who sits, who asks, and acts.
export function createSeats({ deckit, DESKTOP }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const ROSTERED = ROSTER.createRoster();
    const pages = new Set(); // the pages told each change

    // MARK: - Initializer
    // MARK: - Public
    // What a mod with deckit.seats knows of the seats and does to them (sdk: shell/seats). It is told plain data under
    // ids of the roster's own, and what it asks is done whichever seat's press made it ask: an ask is answered by
    // whoever sits, and nothing here knows which seat that was.
    function start() {
        PROTOCOL.read.handle(() => ROSTERED.told(DESKTOP.seats.now()));
        PROTOCOL.watch.handle((_payload, sender) => {
            if (!pages.has(sender)) deckit.pages.whenEnds(sender, () => pages.delete(sender));
            pages.add(sender);
        });
        PROTOCOL.answer.handle(({ ask, allow }) => {
            const id = ROSTERED.askOf(ask);
            return id !== null && DESKTOP.seats.answer(id, allow);
        });
        PROTOCOL.follow.handle(({ seat = null }) => {
            const id = seat === null ? null : ROSTERED.seatOf(seat);
            if (seat !== null && id === null) return false;
            return DESKTOP.seats.follow(id);
        });
        // A seat has its id from the moment it sits and an ask from the moment it waits, whether or not any mod read.
        const noted = () => ROSTERED.told(DESKTOP.seats.now());
        noted();
        DESKTOP.seats.onChange(() => {
            noted();
            for (const page of pages) PROTOCOL.changed.send(page, {});
        });
    }

    // MARK: - Private

    return { start };
}
