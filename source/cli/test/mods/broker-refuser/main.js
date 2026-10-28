// A headless mod that opens exports in start and refuses every connection.
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
