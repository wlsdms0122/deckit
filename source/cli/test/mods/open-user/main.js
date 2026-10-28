// A headless mod that asks for every address of a scheme of its own and answers one query in the switcher with an
// action that marks its page. The test opens an address by an event it sends the page, types the query in the
// switcher, and reads the marks.
class OpenUser {
    start(deckit) {
        const marks = document.documentElement.dataset;
        deckit.urls.register((url) => {
            marks.opened = url;
            return true;
        });
        document.addEventListener(
            'test-open',
            async ({ detail: url }) => (marks.answered = String(await deckit.urls.open(url)))
        );
    }

    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        deckit.dependencies.onConnect('switcher', async (switcher) => {
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
