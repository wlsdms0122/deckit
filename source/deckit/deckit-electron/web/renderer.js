import * as PARTITION from './model/partition.js';
import { post, request, on, CHANNEL } from '../messages/renderer.js';
import { surfaceNameOf } from '../page/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A web page shown in a mod's page, as the Electron environment shows one (deckit-shell/environment: WEB_PAGE): WebKit
// draws it in a view of its own laid just over the document its element is in, this page's or a surface it opened, so
// the element only holds its place, and each frame its place is told to main. What that document draws where it is lies
// under it; what floats over the page is in its overlay, over both. The keyboard goes to one of the two: the element is
// focused while the web page has it, and a press in the web page is a press on the element.
function createViews() {
    const shown = new Map(); // id -> what main tells of it, `told(event)`
    on(CHANNEL.webTold, ({ id, event }) => shown.get(id)?.told(event));

    // `sessions` is the prefix main told the page its mod's sessions are spelled under.
    function view({ sessions, session, url, page }, { closing, focused }) {
        const element = document.createElement('div');
        element.tabIndex = -1;
        // A web page's element, naming the page once main has given it its id.
        element.dataset.webPage = '';
        // White under the page until it draws, as a browser has.
        Object.assign(element.style, { background: '#fff', outline: 'none' });
        let known = null;
        let connected = false;
        let removed = false;
        let sent = '';
        let hasKeyboard = false;
        let focusing = false;
        let watched = null; // the document whose focus is watched, the element's

        const id = new Promise((resolve) => {
            request(CHANNEL.webShow, {
                partition: PARTITION.spellIn(sessions, session),
                url: url || 'about:blank',
                ...(page === undefined ? {} : { page }),
            }).then((given) => {
                if (given === null) return;
                known = given;
                element.dataset.webPage = String(given);
                if (removed) return post(CHANNEL.webRemove, { id: given });
                shown.set(given, { told });
                resolve(given);
            });
        });

        function told(event) {
            if (event === 'close') closing();
            if (event === 'press')
                element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
            if (event !== 'focus') return;
            hasKeyboard = true;
            focusing = true;
            element.focus({ preventScroll: true });
            focusing = false;
            focused();
        }

        // Focusing the element hands the web page the keyboard; focusing anything else of its document takes it back.
        element.addEventListener('focus', () => {
            if (!focusing && known !== null) post(CHANNEL.webFocus, { id: known });
        });
        const leave = () => {
            if (!hasKeyboard || element.ownerDocument.activeElement === element) return;
            hasKeyboard = false;
            post(CHANNEL.webUnfocus, { id: known });
        };
        const watch = (target) => {
            watched?.removeEventListener('focusin', leave, true);
            watched = target;
            watched?.addEventListener('focusin', leave, true);
        };

        // Gone from the document once it was in it, the web page goes. Its place is read in the frames of the document
        // it is in, or of this page's while that one is shown nowhere: a closing surface hands the next to the page.
        const next = () => {
            const view = element.ownerDocument.defaultView;
            if (!view || view === window) return requestAnimationFrame(frame);
            const asked = view.requestAnimationFrame(() => {
                view.removeEventListener('pagehide', away);
                frame();
            });
            const away = () => {
                view.cancelAnimationFrame(asked);
                requestAnimationFrame(frame);
            };
            view.addEventListener('pagehide', away, { once: true });
        };
        const frame = () => {
            if (removed) return;
            if (!element.isConnected) {
                if (connected) return remove();
                return next();
            }
            connected = true;
            if (watched !== element.ownerDocument) watch(element.ownerDocument);
            if (known !== null) place();
            leave();
            next();
        };
        next();

        function place() {
            const rect = element.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0 && element.checkVisibility({ visibilityProperty: true });
            const surface = surfaceNameOf(element.ownerDocument.defaultView);
            const layout = { id: known, frame: plain(rect), visible, ...(surface === undefined ? {} : { surface }) };
            const said = JSON.stringify(layout);
            if (said === sent) return;
            sent = said;
            post(CHANNEL.webPlace, layout);
        }

        function remove() {
            if (removed) return;
            removed = true;
            watch(null);
            if (known === null) return;
            shown.delete(known);
            post(CHANNEL.webRemove, { id: known });
        }

        // Ended where it is, or before it was ever put in the document.
        const close = () => {
            element.remove();
            remove();
        };

        return { element, id, close, focus };

        // The element focused anew and main told at once: a document without the keyboard, as while its overlay has
        // it, holds its focus event back until it has it again, which only this hands it.
        function focus() {
            if (element.ownerDocument.activeElement === element) element.blur();
            focusing = true;
            element.focus({ preventScroll: true });
            focusing = false;
            if (known !== null) post(CHANNEL.webFocus, { id: known });
        }
    }

    return { view };
}

// MARK: - Private
function plain(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export { createViews };
