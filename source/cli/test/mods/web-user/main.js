// A headless mod that shows a web page in a window of its own, as a sign-in does. The test opens the window at an
// address and closes it by events it sends the page, and reads the address the page tells it it is at, and the one it
// is done loading. It also sends the requests the test hands it, as its session, and keeps what each was answered, its
// body as bytes, by the name the test gives it.
class WebUser {
    attach(shell, deckit, { web }) {
        const marks = document.documentElement.dataset;
        const session = web.session('sign-in');
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
        document.addEventListener('test-web-fetch', async ({ detail: { as, url, init } }) => {
            try {
                const answer = await session.fetch(url, init);
                const bytes = answer.body === undefined ? null : [...Uint8Array.fromBase64(answer.body)];
                const { status, redirected } = answer;
                const headers = Object.fromEntries(answer.headers);
                marks[as] = JSON.stringify({ url: answer.url, status, redirected, headers, bytes });
            } catch (error) {
                marks[as] = JSON.stringify({ error: error.message, kind: error.kind });
            }
        });
    }
}

module.exports = WebUser;
