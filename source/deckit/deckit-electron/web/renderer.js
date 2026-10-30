import * as PARTITION from './model/partition.js';
import * as PROTOCOL from './protocol.js';

// MARK: - Property
// How far apart the points are where the page is asked what it draws over a web page.
const PROBE_STEP = 32;
// Every how many frames that is asked again, and for how many frames after the page changed, scrolled or was resized:
// what draws over a web page moves as it settles.
const PROBE_EVERY = 4;
const SETTLING = 30;

// MARK: - Initializer
// MARK: - Public
// A web page shown in a mod's page, as the Electron environment shows one (deckit-shell/environment: PAGE.web): WebKit
// draws it in a view of its own over this page, so the element only holds its place. Each frame its place is told to
// main, with where this page draws over it: what is placed in the page is cut out of the web page and shows, and while
// what floats over the window covers it, a menu, a popover or a dialog, the web page is shown as a picture of itself
// under it. The keyboard goes to one of the two: the element is focused while the web page has it, and a press in
// the web page is a press on the element.
function createViews() {
    const { ipcRenderer } = require('electron');
    const shown = new Map(); // id -> what main tells of it, `told(event)`
    ipcRenderer.on(PROTOCOL.told, (_event, { id, event }) => shown.get(id)?.told(event));
    let changed = 0; // a count of the page's changes, which a web page probes again after
    const change = () => changed++;
    new MutationObserver(change).observe(document, { subtree: true, childList: true, attributes: true });
    window.addEventListener('scroll', change, true);
    window.addEventListener('resize', change);

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
        let over = { holes: [], floating: false };
        let frames = 0;
        let seen = -1; // the count of changes the last probe saw
        let settling = 0;
        let picture = 'none'; // 'none', 'taking', or 'shown'
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
            if (seen !== changed) {
                seen = changed;
                settling = SETTLING;
            }
            if (visible && settling > 0 && frames++ % PROBE_EVERY === 0) over = overOf(element, rect);
            if (settling > 0) settling--;
            const frozen = visible && over.floating && freeze();
            if (!over.floating) thaw();
            const layout = { id: known, frame: plain(rect), visible, frozen, holes: visible ? over.holes : [] };
            const said = JSON.stringify(layout);
            if (said === sent) return;
            sent = said;
            ipcRenderer.send(PROTOCOL.place, layout);
        }

        // Taken first, then shown under what floats, and only then the web page goes: true once it has.
        function freeze() {
            if (picture === 'none') {
                picture = 'taking';
                ipcRenderer.invoke(PROTOCOL.snapshot, { id: known }).then((image) => {
                    if (picture !== 'taking') return;
                    // At the size it was taken, from the top left: the element may grow or shrink under it.
                    const { width, height } = element.getBoundingClientRect();
                    element.style.backgroundImage = image ? `url("${image}")` : 'none';
                    element.style.backgroundSize = `${width}px ${height}px`;
                    element.style.backgroundRepeat = 'no-repeat';
                    picture = 'shown';
                });
            }
            return picture === 'shown';
        }

        // The web page is back over the picture before it goes.
        function thaw() {
            if (picture === 'none') return;
            picture = 'none';
            requestAnimationFrame(() => picture === 'none' && (element.style.backgroundImage = 'none'));
        }

        function remove() {
            removed = true;
            document.removeEventListener('focusin', leave, true);
            if (known === null) return;
            shown.delete(known);
            ipcRenderer.send(PROTOCOL.remove, { id: known });
        }

        return { element, id };
    }

    return { view };
}

// MARK: - Private
// What this page draws over `element` at `rect`, found where probes find it on top: whether any of it floats over the
// window, and the holes the rest cuts, each the outermost of its own that does not hold the element, in its space,
// with its corners.
function overOf(element, rect) {
    const found = new Set();
    for (let y = rect.top + 1; y < rect.bottom; y += PROBE_STEP) {
        for (let x = rect.left + 1; x < rect.right; x += PROBE_STEP) {
            const hit = document.elementFromPoint(x, Math.min(y, rect.bottom - 1));
            if (!hit || hit === element || element.contains(hit) || hit.contains(element)) continue;
            found.add(hit);
        }
    }
    const floats = (node) => {
        for (let at = node; at && !at.contains(element); at = at.parentElement)
            if (getComputedStyle(at).position === 'fixed') return true;
        return false;
    };
    if ([...found].some(floats)) return { holes: [], floating: true };
    const outermost = new Set(
        [...found].map((hit) => {
            let node = hit;
            while (node.parentElement && !node.parentElement.contains(element)) node = node.parentElement;
            return node;
        })
    );
    const holes = [...outermost]
        .map((node) => ({
            box: node.getBoundingClientRect(),
            radius: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0,
        }))
        .map(({ box, radius }) => ({
            x: Math.max(box.left, rect.left) - rect.left,
            y: Math.max(box.top, rect.top) - rect.top,
            width: Math.min(box.right, rect.right) - Math.max(box.left, rect.left),
            height: Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top),
            radius,
        }))
        .filter((hole) => hole.width > 0 && hole.height > 0);
    return { holes, floating: false };
}

function plain(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export { createViews };
