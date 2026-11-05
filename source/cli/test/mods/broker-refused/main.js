// A headless mod that requires broker-refuser, which refuses it. It marks its page as its start runs.
class BrokerRefused {
    start() {
        document.documentElement.dataset.started = '1';
    }
}

module.exports = BrokerRefused;
