// What the Electron environment does in a page of deck's before deck's own code runs: a press in a document, the page's
// or a surface it opened, that is a drag of its window (model/drag.js), the title bar over the document or a part of
// it marked `--app-region: drag`, drags the window it is in and a double click does what the person set a title bar's
// to do, unless what draws in that document took its drags (`drags.take`); main hears the name a window.open of
// deckit's world targets before the window is asked for, which WebKit does not tell, and the name of the surface a drag
// or a web page's place is in; and what the page says as an error is told to main.
import { post, request, CHANNEL } from '../messages/renderer.js';
import { TAKES, drags } from './model/drag.js';

// MARK: - Property
const REGION = '--app-region';
// What the document's root is told of the title bar over it: that one lies there, and its height.
const TITLE_BAR = 'data-deckit-title-bar';
const BAR_HEIGHT = '--deckit-title-bar-area-height';
const surfaces = new WeakMap(); // a surface's window -> the name it was opened by
const takers = new WeakMap(); // a document -> pressed(event), what took its drags

// MARK: - Initializer
// MARK: - Public
function start() {
    watchDrags(document);
    wrapOpen();
    reportErrors();
}

// The presses that drag the window of `document`, this page's or a surface it opened, each handed to
// `pressed(event)`, its `mousedown`, instead of moving the window: the moves and the release that follow are the
// document's. Answers the off, after which they move the window again.
function take(document, pressed) {
    takers.set(document, pressed);
    return () => takers.get(document) === pressed && takers.delete(document);
}

// The name of the surface `view` is the window of, or undefined for this page's own.
function surfaceNameOf(view) {
    return surfaces.get(view);
}

// MARK: - Private
// The left button's press that drags: the first drags, the second of a double click is the title bar's, each of
// the window the document is shown in, which main finds by the surface's name.
function watchDrags(target) {
    target.addEventListener(
        'mousedown',
        (event) => {
            if (event.button !== 0 || !isDrag(event)) return;
            const pressed = takers.get(target);
            if (pressed) return pressed(event);
            const surface = surfaceNameOf(target.defaultView);
            post(event.detail === 2 ? CHANNEL.titleBar : CHANNEL.drag, surface === undefined ? {} : { surface });
        },
        true
    );
}

// Whether `event`, a press, drags its window, read from the pressed element and what it lies in (drags).
function isDrag(event) {
    const node = event.target;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element) return false;
    const view = element.ownerDocument.defaultView;
    const root = element.ownerDocument.documentElement;
    const height = root.hasAttribute(TITLE_BAR)
        ? parseFloat(view.getComputedStyle(root).getPropertyValue(BAR_HEIGHT))
        : NaN;
    const path = [];
    for (let at = element; at; at = at.parentElement) {
        const region = view.getComputedStyle(at).getPropertyValue(REGION).trim();
        path.push({ takes: at.matches(TAKES) || at.isContentEditable, region });
    }
    return drags({ bar: Number.isFinite(height) ? height : null, y: event.clientY, path });
}

// What opens is a surface main lets the page have, by its name, or what main tells the page's watches of. A surface
// is the opener's to draw in, so its drags are heard here too.
function wrapOpen() {
    const open = window.open;
    window.open = function (url, name, features) {
        const target = name === undefined ? '' : String(name);
        request(CHANNEL.opening, { name: target }, { sync: true });
        try {
            const opened = open.call(this, url, name, features);
            if (opened && !surfaces.has(opened)) {
                surfaces.set(opened, target);
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

export { start, take, surfaceNameOf };
