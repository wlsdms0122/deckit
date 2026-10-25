// A headless mod with a key that works anywhere in the app, whose command marks each press on its page. The test binds
// it again and records a chord through the key map by events it sends the page, and reads the marks.
module.exports = {
    start(deck) {
        const marks = document.documentElement.dataset;
        deck.commands({
            mark: { label: 'Mark', run: () => (marks.pressed = String(Number(marks.pressed || 0) + 1)) },
        });
        deck.keys({ mark: { command: 'mark', key: 'mod+shift+9', scope: 'app' } });
        document.addEventListener('test-bind', async ({ detail: spec }) => {
            await deck.keymap.set('keys-user.mark', spec);
            marks.chord = deck.chordOf('mark');
        });
        document.addEventListener('test-record', () =>
            deck.keymap.record((recorded) => (marks.recorded = JSON.stringify(recorded)))
        );
    },
};
