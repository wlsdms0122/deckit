// A headless mod that opens the exports of broker-provider/broker in start and sends a signal of it. Each connection's
// exports answer who connected, call back what they are handed, throw an error of a kind, and tell whether a function
// handed again is the one handed before.
class BrokerProvider {
    start(deckit) {
        deckit.exports.register('broker-provider/broker', {
            connect: (connection) => {
                let kept = null;
                return {
                    ask: (number) => `${number + 1} ${connection.credential.mod}`,
                    ping: (number) => deckit.events.emit('broker-provider/broker:ping', number),
                    async countTo(last, onCount) {
                        for (let number = 1; number <= last; number++) await onCount(number);
                    },
                    setThing: async (thing) => `${thing.number}: ${await thing.hello('provider')}`,
                    refuse() {
                        throw Object.assign(new RangeError('not now'), { kind: 'LATER' });
                    },
                    keep(given) {
                        const same = given === kept;
                        kept = given;
                        return same;
                    },
                };
            },
        });
    }
}

module.exports = BrokerProvider;
