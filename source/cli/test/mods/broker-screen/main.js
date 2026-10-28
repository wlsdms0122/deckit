// A headless mod that opens its exports in attach: `take(ask)` calls what it is handed. It marks on its page who each
// connection is from, and, as one ends, whether it is the connection its exports were made for. It names the provider
// at a version the provider is not, so it runs without it.
class BrokerScreen {
    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const made = new Set();
        deckit.exports.register({
            connect(connection) {
                made.add(connection);
                marks.connected = connection.mod.id;
                return { take: (ask) => ask(1) };
            },
            disconnect(connection) {
                marks.disconnected = `${connection.mod.id} ${made.has(connection)}`;
                made.delete(connection);
            },
        });
    }
}

module.exports = BrokerScreen;
