// A headless mod that shows a web page in a window of its own, as a sign-in does. The test opens the window at an
// address and closes it by events it sends the page, and reads the address the page tells it it is at, and the one it
// is done loading. It also reads an address the test hands it as its session, and keeps the text it was answered.
class WebUser {
    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const session = deckit.web.session('sign-in');
        let window = null;
        document.addEventListener('test-web-open', ({ detail: url }) => {
            window = shell.web.window({ session, url, title: 'Web User' });
            window.delegate = {
                didChange: (state) => {
                    marks.at = state.url;
                    marks.loaded = state.loading ? '' : state.url;
                },
            };
        });
        document.addEventListener('test-web-close', () => window?.close());
        document.addEventListener('test-web-read', async ({ detail: url }) => {
            marks.read = await session.fetchText(url).catch((error) => 'failed: ' + error.message);
        });
    }
}

module.exports = WebUser;
