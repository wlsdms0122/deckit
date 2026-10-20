// A headless mod with a key that works everywhere, which marks each press on its page. The test binds it again and
// records a chord through the key map by events it sends the page, and reads the marks.
module.exports = {
    start(deck) {
        const marks = document.documentElement.dataset;
        deck.keys({
            mark: {
                key: 'mod+shift+9',
                label: 'Mark',
                global: true,
                run: () => (marks.pressed = String(Number(marks.pressed || 0) + 1)),
            },
        });
        document.addEventListener('test-bind', async ({ detail: spec }) => {
            await deck.keymap.set('keys-user.mark', spec);
            marks.chord = deck.chordOf('mark');
        });
        document.addEventListener('test-record', () =>
            deck.keymap.record((recorded) => (marks.recorded = JSON.stringify(recorded)))
        );
    },
};
