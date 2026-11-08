// A headless mod that uses broker-refuser/refusals, whose owner refuses it. It marks its page as its start runs.
class BrokerRefused {
    start() {
        document.documentElement.dataset.started = '1';
    }
}

module.exports = BrokerRefused;
