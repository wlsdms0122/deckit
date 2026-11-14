// What the scenario serves the seats of the app under test with, for what the shell does not serve yet, the ask:
// fixed answers, so what main hands over and what it answers a user with is read exactly. The shell serves the entry
// and the reading itself. It is loaded into the app's main process as connect
// answers (scenario.js: serveSeats), and what it kept is read there under `deckitTestSeats`.
// The users the ask answers no, and never.
const DENIED = 'outside-denied';
const WAITS = 'outside-waiting';

// `deckit`, what connect answered, with its seats served: every ask is answered yes but those of DENIED and WAITS.
function serve(deckit) {
    const kept = { seats: deckit.seats, asked: [], withdrawn: [], opened: [], closed: [] };
    deckit.seats.onOpen((seat) => kept.opened.push(seat.id));
    deckit.seats.onClose((seat) => kept.closed.push(seat.id));
    deckit.seats.serve({
        onAsk: ({ user }, { signal }) => {
            kept.asked.push(user.id);
            signal.addEventListener('abort', () => kept.withdrawn.push(user.id));
            return user.id === WAITS ? new Promise(() => {}) : Promise.resolve(user.id !== DENIED);
        },
    });
    globalThis.deckitTestSeats = kept;
    return deckit;
}

module.exports = { DENIED, WAITS, serve };
