// A headless mod that opens the addresses of a scheme of its own and answers one query in the switcher with an action
// that marks its page. The test opens an address by an event it sends the page, types the query in the switcher, and
// reads the marks.
module.exports = {
    start(deck) {
        const marks = document.documentElement.dataset;
        deck.handleURL((url) => {
            marks.opened = url;
            return true;
        });
        deck.extends.switcher({
            actions: {
                search: (query) => (query === 'probe open user' ? [{ label: 'Open User Probe', value: 'probe' }] : []),
                run: () => {
                    marks.ran = '1';
                },
            },
        });
        document.addEventListener(
            'test-open',
            async ({ detail: url }) => (marks.answered = String(await deck.open(url)))
        );
    },
};
