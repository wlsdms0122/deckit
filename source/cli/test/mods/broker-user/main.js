// A headless mod that calls what the provider exports, extends its point and hears its event, marking each on its page.
class BrokerUser {
    async start(deckit) {
        const marks = document.documentElement.dataset;
        const provider = deckit.requires['broker-provider'];
        deckit.extends['broker-provider']({ hooks: { hello: (from) => `hello ${from}` } });
        deckit.on('broker-provider:ping', (number) => (marks.pinged = String(number)));
        marks.asked = await provider.ask(41);
        await provider.ping(7);
    }
}

module.exports = BrokerUser;
