// A headless mod that exports, opens an extension point and sends an event, marking on its page what extends it.
module.exports = {
    start(deck) {
        const marks = document.documentElement.dataset;
        deck.exports({
            ask(number) {
                return `${number + 1} ${deck.caller()}`;
            },
            ping(number) {
                deck.emit('ping', number);
            },
        });
        deck.extensionPoint('hooks').onChange(async (extensions) => {
            const user = extensions['broker-user'];
            if (user) marks.extended = await user.hello('provider');
        });
    },
};
