// A headless mod that opens every address of a scheme of its own and answers one query in the switcher with an action
// that marks its page. The test opens an address through deckit/urls by an event it sends the page, types the query in
// the switcher, and reads the marks.
class OpenUser {
    start(deckit) {
        const marks = document.documentElement.dataset;
        deckit.exports.register({
            connect: () => ({
                openURL: (url) => {
                    marks.opened = url;
                    return true;
                },
            }),
        });
        let urls = null;
        deckit.dependencies.onConnect('deckit/urls', (connected) => {
            urls = connected;
            return () => (urls = null);
        });
        document.addEventListener(
            'test-open',
            async ({ detail: url }) => (marks.answered = String(await urls?.open(url, { activates: false })))
        );
    }

    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        deckit.dependencies.onConnect('switcher/actions', async (switcher) => {
            await switcher.setActions({
                search: (query) => (query === 'probe open user' ? [{ label: 'Open User Probe', value: 'probe' }] : []),
                run: () => {
                    marks.ran = '1';
                },
            });
        });
    }
}

module.exports = OpenUser;
