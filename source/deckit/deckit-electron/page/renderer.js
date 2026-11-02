// What the Electron environment does in a page of deck's before deck's own code runs: where the page, or a surface it
// opened, marks itself `--app-region: drag`, a press drags the window it is in and a double click does what the person
// set a title bar's to do, `no-drag` marking what inside it takes presses itself; main hears the name a window.open of
// deckit's world targets before the window is asked for, which WebKit does not tell; and what the page says as an error
// is told to main.
import { post, request, CHANNEL } from '../messages/renderer.js';

// MARK: - Property
const REGION = '--app-region';

// MARK: - Initializer
// MARK: - Public
function start() {
    watchDrags(document);
    wrapOpen();
    reportErrors();
}

// MARK: - Private
// The left button's press in a drag region: the first drags, the second of a double click is the title bar's.
function watchDrags(target) {
    target.addEventListener(
        'mousedown',
        (event) => {
            if (event.button !== 0 || !inDragRegion(event.target)) return;
            post(event.detail === 2 ? CHANNEL.titleBar : CHANNEL.drag, {});
        },
        true
    );
}

function inDragRegion(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element) return false;
    const view = element.ownerDocument.defaultView;
    return view.getComputedStyle(element).getPropertyValue(REGION).trim() === 'drag';
}

// What opens is a surface main lets the page have, by its name, or what main tells the page's watches of. A surface
// is the opener's to draw in, so its drag regions are heard here too.
function wrapOpen() {
    const open = window.open;
    const watched = new WeakSet();
    window.open = function (url, name, features) {
        request(CHANNEL.opening, { name: name === undefined ? '' : String(name) }, { sync: true });
        try {
            const opened = open.call(this, url, name, features);
            if (opened && !watched.has(opened)) {
                watched.add(opened);
                watchDrags(opened.document);
            }
            return opened;
        } finally {
            post(CHANNEL.opened, {});
        }
    };
}

// What deckit's world says as an error, a throw nothing caught and a promise nothing handled.
function reportErrors() {
    const report = (message) => post(CHANNEL.consoleError, { message: String(message) });
    const error = console.error;
    console.error = (...parts) => {
        report(parts.map((part) => (part instanceof Error ? part.stack || part.message : String(part))).join(' '));
        return error.apply(console, parts);
    };
    window.addEventListener('error', (event) => report(event.error?.stack || event.message));
    window.addEventListener('unhandledrejection', (event) => report(event.reason?.stack || event.reason));
}

export { start };
