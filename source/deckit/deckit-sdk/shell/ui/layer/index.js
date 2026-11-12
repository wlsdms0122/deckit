import * as SHEET from '../sheet/index.js';

// MARK: - Property
// The page's overlay: `{ window, document, tell({ shows, focused, regions }), take() }`, a document beside the page's
// own, laid over the page while it draws anything. Its layers are the elements in its body, each over the page and the
// layers before it. Elements made in the page are drawn there as they are, with the page's rules copied in.
let overlay = null;
let style = null; // what wears the copies in the overlay
const worn = new Map(); // another document of the page's that wears its rules, by its window -> what wears them there
let told = '';
const awaited = new WeakSet(); // the animations in the overlay whose end is told

// MARK: - Initializer
// MARK: - Public
// Where the overlay draws and what holds the focus in it are told again as they change, where it draws once what moves
// in it stops, however it moves, and after a press, once the focus moved, so main hears where the keyboard belongs.
function start(given) {
    overlay = given;
    style = overlay.document.createElement('style');
    overlay.document.head.replaceChildren(style);
    overlay.document.body.replaceChildren();
    const resized = new overlay.window.ResizeObserver(() => report());
    new MutationObserver(() => {
        resized.disconnect();
        for (const child of overlay.document.body.children) resized.observe(child);
        report();
    }).observe(overlay.document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'data-state', 'hidden'],
    });
    overlay.window.addEventListener('resize', () => report());
    for (const type of ['focusin', 'focusout']) overlay.document.addEventListener(type, () => setTimeout(report));
    for (const type of ['focus', 'blur']) overlay.window.addEventListener(type, () => setTimeout(report));
    overlay.window.addEventListener('pointerdown', () => setTimeout(() => report({ again: true })), true);
}

// Adds `element` to the page's overlay, over the page and every layer added before it, and answers the layer:
// `{ element, focus(target), remove() }`. The overlay takes presses where a layer draws what takes them, and has the
// keyboard while an element in a layer holds the focus, once the person presses there or `focus(target)` gives it:
// `target`, `element` unless given, an element or a control with `focus()`, takes the focus and the keyboard the page
// has. A layer takes presses where it lies over a part of the page that drags the window too.
function add(element) {
    if (!overlay.document.body.childElementCount) dress();
    element.style.setProperty('--app-region', 'no-drag');
    overlay.document.body.append(element);
    return Object.freeze({
        element,
        focus: (target = element) => {
            target.focus();
            take();
        },
        remove: () => element.remove(),
    });
}

// The keyboard the page has goes to the overlay, for what holds the focus in it now.
function take() {
    report();
    overlay.take();
}

// The element in a layer that has the keyboard, or null.
function focused() {
    const { document } = overlay;
    const active = document.activeElement;
    return document.hasFocus() && active && active !== document.body && document.body.contains(active) ? active : null;
}

// The page, its overlay and the documents that wear its rules, where the pointer and the keys are heard.
function windows() {
    return [window, overlay.window, ...worn.keys()];
}

// The element with the focus in the one of those documents that has the keyboard, or null.
function activeElement() {
    for (const { document } of windows()) {
        const active = document.activeElement;
        if (document.hasFocus() && active && active !== document.body) return active;
    }
    return null;
}

// Another document of the page's, in the window `opened`, wears the page's rules as they change, as the overlay does,
// and is heard where the page is. Answers the off.
function wear(opened) {
    const sheet = opened.document.createElement('style');
    opened.document.head.prepend(sheet);
    worn.set(opened, sheet);
    dress();
    return () => worn.get(opened) === sheet && worn.delete(opened);
}

// The overlay and the documents that wear the page's rules wear them as they are now.
function dress() {
    const text = document.adoptedStyleSheets.map((sheet) => SHEET.textOf(sheet)).join('\n');
    const scheme = document.documentElement.style.colorScheme;
    const wearers = [...(overlay ? [[overlay.window, style]] : []), ...worn];
    for (const [opened, sheet] of wearers) {
        if (sheet.textContent !== text) sheet.textContent = text;
        opened.document.documentElement.style.colorScheme = scheme;
    }
}

// Whether the overlay draws anything, so it is laid over the page.
function draws() {
    return overlay.document.body.childElementCount > 0;
}

// The window whose viewport a box drawn in `view` is laid in: the page's for the overlay, which is laid at the page's
// rect and has no size of its own until it is.
function viewportOf(view) {
    return overlay && view === overlay.window ? window : view;
}

// MARK: - Private
// Told when it changed, or `again`: whether the overlay draws anything, whether an element in it has the keyboard, and
// where it draws what takes presses.
function report({ again = false } = {}) {
    for (const animation of overlay.document.getAnimations()) {
        if (awaited.has(animation)) continue;
        awaited.add(animation);
        animation.finished.then(
            () => report(),
            () => report()
        );
    }
    const state = {
        shows: draws(),
        focused: !!focused(),
        regions: [...overlay.document.body.children]
            .filter((child) => overlay.window.getComputedStyle(child).pointerEvents !== 'none')
            .map((child) => {
                const { x, y, width, height } = child.getBoundingClientRect();
                return { x, y, width, height };
            }),
    };
    const written = JSON.stringify(state);
    if (written === told && !again) return;
    told = written;
    overlay.tell(state);
}

export { start, add, take, focused, windows, activeElement, wear, dress, draws, viewportOf };
