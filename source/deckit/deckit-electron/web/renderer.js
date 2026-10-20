import * as PARTITION from './model/partition.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A web page shown in a mod's page, as Electron shows one (deckit-shell/environment: PAGE.web): a <webview>, not a
// frame, since a framed page knows it is framed and the cookies it writes are third-party.
function createViews() {
    // Unique across reloads of this document, since main may still be closing the last one's pages.
    const boot = Date.now().toString(36);
    let sequence = 0;

    // `partition` has to be on the element before `src` is. `sessions` is the prefix main told the page its mod's
    // sessions are spelled under.
    function view({ sessions, session, url }, { closing, focused }) {
        const key = boot + '-' + ++sequence;
        const element = document.createElement('webview');
        element.dataset.deckitPage = key;
        element.setAttribute('partition', PARTITION.spellIn(sessions, session));
        element.setAttribute('src', url || 'about:blank');
        // Without it a <webview> refuses every window.open before main is asked.
        element.setAttribute('allowpopups', '');
        // White under the page, as a browser has: a <webview> is see-through, and a site that leaves its own
        // background unset would show what is under it through its text.
        element.style.background = '#fff';
        // The <webview>'s methods exist only in the document's main world, not this one, so its id is read from there,
        // once it has one.
        const id = new Promise((resolve) => {
            const read = async () => {
                const found = await require('electron').webFrame.executeJavaScript(
                    `document.querySelector('webview[data-deckit-page="${key}"]')?.getWebContentsId() ?? null`
                );
                if (found === null) return;
                element.removeEventListener('dom-ready', read);
                resolve(found);
            };
            element.addEventListener('dom-ready', read);
        });
        element.addEventListener('close', () => closing());
        // Focus is the only sign of a click in the page this document gets.
        element.addEventListener('focus', () => focused());
        return { element, id };
    }

    return { view };
}

// MARK: - Private

export { createViews };
