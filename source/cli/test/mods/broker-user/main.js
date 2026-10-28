// A headless mod that depends on the provider, the screen and a mod that is not installed. In start it calls what the
// provider exports, hands it functions and an object of a class, and hears its event; in attach, as the screen
// connects, it hands the screen one of the provider's functions and one of its own, and counts the screen's
// connections and their ends. It marks each on its page.
class Thing {
    constructor(number) {
        this.number = number;
    }

    hello(from) {
        return `${this.number} hello ${from}`;
    }
}

class BrokerUser {
    async start(deckit) {
        const marks = document.documentElement.dataset;
        const provider = deckit.dependencies['broker-provider'];
        marks.lasting = Object.keys(deckit.dependencies)
            .filter((key) => key !== 'onConnect')
            .join();
        deckit.events.on('broker-provider:ping', (number) => (marks.pinged = String(number)));
        marks.asked = await provider.ask(41);
        const counted = [];
        await provider.countTo(3, (number) => counted.push(number));
        marks.counted = counted.join();
        marks.thing = await provider.setThing(new Thing(7));
        const hello = () => 'hello';
        marks.same = `${await provider.keep(hello)} ${await provider.keep(hello)}`;
        await provider.ping(7);
    }

    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const provider = deckit.dependencies['broker-provider'];
        deckit.dependencies.onConnect('broker-screen', async (screen) => {
            marks.screens = String(Number(marks.screens || 0) + 1);
            marks.handedOn = await screen.take(provider.ask).then(
                () => 'handed on',
                (error) => error.message
            );
            marks.wrapped = await screen.take((number) => provider.ask(number));
            return () => (marks.cleaned = String(Number(marks.cleaned || 0) + 1));
        });
    }
}

module.exports = BrokerUser;
