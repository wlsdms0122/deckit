// A headless mod that opens its exports, for the mods that depend on it by id, in start and refuses every connection.
class BrokerRefuser {
    start(deckit) {
        deckit.exports.register({
            connect() {
                throw new Error('no connections here');
            },
        });
    }
}

module.exports = BrokerRefuser;
