// A headless mod that uses broker-refuser/refusals, whose owner refuses it. It marks its page as its start runs, and
// as it hears the refusal, which it throws again so its row says it.
class BrokerRefused {
    start(deckit) {
        document.documentElement.dataset.started = '1';
        deckit.dependencies.onRefuse('broker-refuser/refusals', (error) => {
            document.documentElement.dataset.refused = `${error.stage} ${error.kind}`;
            throw error;
        });
    }
}

module.exports = BrokerRefused;
