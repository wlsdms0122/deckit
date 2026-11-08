// A headless mod that opens the exports of broker-screen/takes in attach: `take(ask)` calls what it is handed. It marks
// on its page who each connection is from, and, as one ends, whether it is the connection its exports were made for. It
// uses broker-provider/broker at a major its owner does not provide, so it reaches no one by it.
class BrokerScreen {
    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const made = new Set();
        deckit.exports.register('broker-screen/takes', {
            connect(connection) {
                made.add(connection);
                marks.connected = connection.credential.mod;
                return { take: (ask) => ask(1) };
            },
            disconnect(connection) {
                marks.disconnected = `${connection.credential.mod} ${made.has(connection)}`;
                made.delete(connection);
            },
        });
    }
}

module.exports = BrokerScreen;
