// A headless mod that opens its exports in start and sends an event. Each connection's exports answer who connected,
// call back what they are handed, and tell whether a function handed again is the one handed before.
class BrokerProvider {
    start(deckit) {
        deckit.exports.register({
            connect: (connection) => {
                let kept = null;
                return {
                    ask: (number) => `${number + 1} ${connection.mod.id}`,
                    ping: (number) => deckit.events.emit('ping', number),
                    async countTo(last, onCount) {
                        for (let number = 1; number <= last; number++) await onCount(number);
                    },
                    setThing: async (thing) => `${thing.number}: ${await thing.hello('provider')}`,
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
