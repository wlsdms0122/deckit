// A headless mod with a key that works anywhere in the app, declared to run its command, so a press launches it, which
// marks each press on its page. The test binds the key again from the window probe and has this mod read its chord
// through deckit/keys by an event it sends the page, and reads the marks.
class KeysUser {
    start(deckit) {
        const marks = document.documentElement.dataset;
        deckit.exports.register({
            connect: () => ({
                runCommand: (id) => {
                    if (id !== 'mark') throw new Error(`no command ${id}`);
                    marks.pressed = String(Number(marks.pressed || 0) + 1);
                },
            }),
        });
        let keys = null;
        deckit.dependencies.onConnect('deckit/keys', (connected) => {
            keys = connected;
            return () => (keys = null);
        });
        document.addEventListener('test-chord', async () => (marks.chord = await keys?.chordOf('mark')));
    }
}

module.exports = KeysUser;
