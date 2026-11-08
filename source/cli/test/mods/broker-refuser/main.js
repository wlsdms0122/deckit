// A headless mod that opens the exports of broker-refuser/refusals in start and refuses every connection.
class BrokerRefuser {
    start(deckit) {
        deckit.exports.register('broker-refuser/refusals', {
            connect() {
                throw new Error('no connections here');
            },
        });
    }
}

module.exports = BrokerRefuser;
