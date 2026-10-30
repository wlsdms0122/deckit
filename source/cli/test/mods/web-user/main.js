// A headless mod that shows a web page in a window of its own, as a sign-in does. The test opens the window at an
// address and closes it by events it sends the page, and reads the address the page tells it it is at.
class WebUser {
    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const session = deckit.web.session('sign-in');
        let window = null;
        document.addEventListener('test-web-open', ({ detail: url }) => {
            window = shell.web.window({ session, url, title: 'Web User' });
            window.delegate = { didChange: (state) => (marks.at = state.url) };
        });
        document.addEventListener('test-web-close', () => window?.close());
    }
}

module.exports = WebUser;
