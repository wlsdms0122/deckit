// A headless mod that exports, opens an extension point and sends an event, marking on its page what extends it.
class BrokerProvider {
    start(deckit) {
        const marks = document.documentElement.dataset;
        deckit.exports({
            ask(number) {
                return `${number + 1} ${deckit.caller()}`;
            },
            ping(number) {
                deckit.emit('ping', number);
            },
        });
        deckit.extensionPoint('hooks').onChange(async (extensions) => {
            const user = extensions['broker-user'];
            if (user) marks.extended = await user.hello('provider');
        });
    }
}

module.exports = BrokerProvider;
