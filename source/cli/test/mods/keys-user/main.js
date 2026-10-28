// A headless mod with a key that works anywhere in the app, which marks each press on its page. The test binds
// it again and records a chord through the key map by events it sends the page, and reads the marks.
class KeysUser {
    start(deckit) {
        const marks = document.documentElement.dataset;
        deckit.keys.register({
            mark: {
                label: 'Mark',
                key: 'mod+shift+9',
                scope: 'app',
                run: () => (marks.pressed = String(Number(marks.pressed || 0) + 1)),
            },
        });
        document.addEventListener('test-bind', async ({ detail: spec }) => {
            await deckit.keys.bind('keys-user.mark', spec);
            marks.chord = deckit.keys.chordOf('mark');
        });
        document.addEventListener('test-record', () =>
            deckit.keys.record((recorded) => (marks.recorded = JSON.stringify(recorded)))
        );
    }
}

module.exports = KeysUser;
