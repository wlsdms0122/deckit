// MARK: - Property
const TOPMOST = '2147483647';
let before = null; // { x, y } of the move before the last, in the window
let now = null;
let waiting = [];
let tracked = []; // the windows the pointer is tracked in

// MARK: - Initializer
// MARK: - Public
// The page's one pointer tracker, over the page and its overlay (`windows`). Forgotten when a window stops seeing the
// pointer: a page hidden while the pointer is over it gets no mouseout, and the first move afterwards is a position,
// not a move.
function start(windows) {
    tracked = windows;
    for (const each of windows) {
        each.addEventListener('mousemove', track, { capture: true, passive: true });
        each.addEventListener('mouseout', (event) => !event.relatedTarget && forget(), { capture: true });
        each.addEventListener('blur', forget);
        each.document.addEventListener('visibilitychange', () => each.document.hidden && forget());
    }
}

function position() {
    return now;
}

// `listener(lost)` runs once: false at the next move, true when the pointer is lost first.
function afterMove(listener) {
    waiting.push(listener);
}

// The browser reports a pointer that stayed put as a move when something appears under it, so a move counts
// only when the position changed.
function hoverIntent(element, listener) {
    const moved = (event) => {
        if (before && (before.x !== now.x || before.y !== now.y)) listener(event);
    };
    element.addEventListener('mousemove', moved);
    return () => element.removeEventListener('mousemove', moved);
}

// A transparent cover over the page while a drag lasts: over an iframe or a webview the pointer's events would
// go to that document and the drag would end with the button still down. An overlay that shows anything, what a drag
// carries among it, is over the page, so it is covered too, for the cursor. Returns the release.
function capture(cursor) {
    const shown = tracked.filter((each) => each === window || each.document.body.childElementCount);
    const covers = shown.map((each) => {
        const cover = each.document.createElement('div');
        Object.assign(cover.style, { position: 'fixed', inset: '0', zIndex: TOPMOST, cursor });
        cover.dataset.deckitCapture = '';
        each.document.body.append(cover);
        return cover;
    });
    return () => covers.forEach((cover) => cover.remove());
}

// MARK: - Private
function track(event) {
    before = now;
    now = { x: event.clientX, y: event.clientY };
    settle(false);
}

function forget() {
    before = now = null;
    settle(true);
}

function settle(lost) {
    const listeners = waiting;
    waiting = [];
    for (const listener of listeners) listener(lost);
}

export { start, position, afterMove, hoverIntent, capture };
