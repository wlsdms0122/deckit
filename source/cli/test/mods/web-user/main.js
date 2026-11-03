// A headless mod that shows a web page in a window of its own, as a sign-in does. The test opens the window at an
// address and closes it by events it sends the page, and reads the address the page tells it it is at, and the one it
// is done loading. It also sends the requests the test hands it, as its session, and keeps what each was answered, by
// the name the test gives it.
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
        document.addEventListener('test-web-fetch', async ({ detail: { as, url, init } }) => {
            try {
                const response = await session.fetch(url, init);
                const bytes = [...new Uint8Array(await response.arrayBuffer())];
                const { status, redirected } = response;
                const headers = Object.fromEntries(response.headers);
                marks[as] = JSON.stringify({ url: response.url, status, redirected, headers, bytes });
            } catch (error) {
                marks[as] = JSON.stringify({ error: error.message });
            }
        });
    }
}

module.exports = WebUser;
