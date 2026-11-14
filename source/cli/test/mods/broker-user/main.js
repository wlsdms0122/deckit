// A headless mod that uses the interface the provider provides, the one the screen provides, and one no mod installed
// provides. In start, as the provider connects, it calls what the provider exports, one of which throws, hands it
// functions and an object of a class, and hears its signal, and marks which of the provider's and the absent interface
// connected; in attach, as the screen connects, it hands the screen one of the provider's functions and one of its own,
// and counts the screen's connections and their ends. It marks each on its page.
const PROVIDER = 'broker-provider/broker';

class Thing {
    constructor(number) {
        this.number = number;
    }

    hello(from) {
        return `${this.number} hello ${from}`;
    }
}

class BrokerUser {
    start(deckit) {
        const marks = document.documentElement.dataset;
        const connected = [];
        for (const named of [PROVIDER, 'broker-absent/none'])
            deckit.dependencies.onConnect(named, () => {
                connected.push(named);
                marks.lasting = connected.join();
            });
        // What hearing a signal throws is marked, so the rest runs on.
        try {
            deckit.events.on(`${PROVIDER}:ping`, (number) => (marks.pinged = String(number)));
        } catch (error) {
            marks.pinged = `refused: ${error.message}`;
        }
        deckit.dependencies.onConnect(PROVIDER, async (provider) => {
            marks.asked = await provider.ask(41);
            const counted = [];
            await provider.countTo(3, (number) => counted.push(number));
            marks.counted = counted.join();
            marks.thing = await provider.setThing(new Thing(7));
            const hello = () => 'hello';
            marks.same = `${await provider.keep(hello)} ${await provider.keep(hello)}`;
            marks.refused = await provider.refuse().then(
                () => 'answered',
                (error) => `${error.stage} ${error.kind} ${error.message}`
            );
            await provider.ping(7);
        });
    }

    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        let provider = null;
        deckit.dependencies.onConnect(PROVIDER, (connected) => {
            provider = connected;
            return () => (provider = null);
        });
        deckit.dependencies.onConnect('broker-screen/takes', async (screen) => {
            marks.screens = String(Number(marks.screens || 0) + 1);
            marks.handedOn = await screen.take(provider?.ask).then(
                () => 'handed on',
                (error) => error.message
            );
            marks.wrapped = await screen.take((number) => provider.ask(number));
            return () => (marks.cleaned = String(Number(marks.cleaned || 0) + 1));
        });
    }
}

module.exports = BrokerUser;
