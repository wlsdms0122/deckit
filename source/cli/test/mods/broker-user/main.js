// A headless mod that calls what the provider exports, extends its point and hears its event, marking each on its page.
module.exports = {
    async start(deck) {
        const marks = document.documentElement.dataset;
        const provider = deck.requires['broker-provider'];
        deck.extend({ 'broker-provider:hooks': { hello: (from) => `hello ${from}` } });
        deck.on('broker-provider:ping', (number) => (marks.pinged = String(number)));
        marks.asked = await provider.ask(41);
        await provider.ping(7);
    },
};
