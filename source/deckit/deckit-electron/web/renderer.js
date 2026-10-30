import * as PARTITION from './model/partition.js';
import * as PROTOCOL from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A web page shown in a mod's page, as the Electron environment shows one (deckit-shell/environment: PAGE.web): WebKit
// draws it in a view of its own over this page, so the element only holds its place, and each frame its place is
// told to main. What this page draws where it is lies under it; what floats over the page is in its overlay, over
// both. The keyboard goes to one of the two: the element is focused while the web page has it, and a press in the web
// page is a press on the element.
function createViews() {
    const { ipcRenderer } = require('electron');
    const shown = new Map(); // id -> what main tells of it, `told(event)`
    ipcRenderer.on(PROTOCOL.told, (_event, { id, event }) => shown.get(id)?.told(event));

    // `sessions` is the prefix main told the page its mod's sessions are spelled under.
    function view({ sessions, session, url }, { closing, focused }) {
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

        const id = new Promise((resolve) => {
            ipcRenderer
                .invoke(PROTOCOL.show, { partition: PARTITION.spellIn(sessions, session), url: url || 'about:blank' })
                .then((given) => {
                    if (given === null) return;
                    known = given;
                    element.dataset.webPage = String(given);
                    if (removed) return ipcRenderer.send(PROTOCOL.remove, { id: given });
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

        // Focusing the element hands the web page the keyboard; focusing anything else of this page takes it back.
        element.addEventListener('focus', () => {
            if (!focusing && known !== null) ipcRenderer.send(PROTOCOL.focus, { id: known });
        });
        const leave = () => {
            if (!hasKeyboard || document.activeElement === element) return;
            hasKeyboard = false;
            ipcRenderer.send(PROTOCOL.unfocus, { id: known });
        };
        document.addEventListener('focusin', leave, true);

        // Gone from the document once it was in it, the web page goes.
        const frame = () => {
            if (removed) return;
            if (!element.isConnected) {
                if (connected) return remove();
                return requestAnimationFrame(frame);
            }
            connected = true;
            if (known !== null) place();
            leave();
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);

        function place() {
            const rect = element.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0 && element.checkVisibility({ visibilityProperty: true });
            const layout = { id: known, frame: plain(rect), visible };
            const said = JSON.stringify(layout);
            if (said === sent) return;
            sent = said;
            ipcRenderer.send(PROTOCOL.place, layout);
        }

        function remove() {
            if (removed) return;
            removed = true;
            document.removeEventListener('focusin', leave, true);
            if (known === null) return;
            shown.delete(known);
            ipcRenderer.send(PROTOCOL.remove, { id: known });
        }

        // Ended where it is, or before it was ever put in the document.
        const close = () => {
            element.remove();
            remove();
        };

        return { element, id, close };
    }

    return { view };
}

// MARK: - Private
function plain(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export { createViews };
