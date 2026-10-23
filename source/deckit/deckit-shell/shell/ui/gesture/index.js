import * as POINTER from '../pointer/index.js';
import * as OVERLAY from '../overlay/index.js';

// MARK: - Property
// A pointer that has not travelled this far since the press is a click, not a drag.
const SLOP = 4;
// How near an edge of what scrolls the pointer starts scrolling it.
const EDGE = 28;
const STEP_MAX = 12;
const LINE = 16;
const SIDES = Object.freeze({
    x: { start: 'left', end: 'right', offset: 'scrollLeft' },
    y: { start: 'top', end: 'bottom', offset: 'scrollTop' },
});
const gestures = new WeakMap(); // area -> the gesture under way in it

// MARK: - Initializer
// MARK: - Public
// The gesture under every drag in the kit. `pick(target)` finds the thing under a press. Past SLOP,
// `begin(item, down, finished)` returns the drag { follow(x, y), drop(x, y), cancel(), scroller?(x, y),
// settleNow?() } or null; the drag calls `finished()` once it has played out. `scroller(x, y)` answers what scrolls
// under the pointer, at its edges and by the wheel, `{ element, axis }` with `axis` `x` or `y`, or null. `cursor` is
// the pointer's while the drag holds. A gesture is in one phase at a time (pressed, held, settling, ended) and every
// handler reads only that.
function drag(area, { pick, begin, cursor = 'grabbing' }) {
    const onDragStart = (event) => pick(event.target) && event.preventDefault();
    const onDown = (down) => press(area, down, pick, begin, cursor);
    area.addEventListener('dragstart', onDragStart);
    area.addEventListener('pointerdown', onDown);
    return () => {
        area.removeEventListener('dragstart', onDragStart);
        area.removeEventListener('pointerdown', onDown);
    };
}

// MARK: - Private
function press(area, down, pick, begin, cursor) {
    if (down.button !== 0 || down.target.closest?.('input, textarea, [contenteditable]')) return;
    const item = pick(down.target);
    if (!item || !area.contains(item)) return;
    gestures.get(area)?.end();
    let phase = 'pressed';
    let held = null;
    let x = down.clientX;
    let y = down.clientY;
    let release = null;
    let layer = null;
    let frame = 0;

    const listen = (on) => {
        const method = on ? 'addEventListener' : 'removeEventListener';
        window[method]('pointermove', onMove, true);
        window[method]('pointerup', onUp, true);
        window[method]('pointercancel', onCancel, true);
    };
    const letGo = () => {
        release?.();
        release = null;
        layer?.close();
        layer = null;
        window.removeEventListener('wheel', onWheel, { capture: true });
        cancelAnimationFrame(frame);
    };
    const finished = () => {
        if (phase === 'ended') return;
        phase = 'ended';
        letGo();
        if (gestures.get(area) === gesture) gestures.delete(area);
    };
    const settle = (how) => {
        phase = 'settling';
        letGo();
        how();
    };
    const callOff = () => phase === 'held' && settle(() => held.cancel());
    // A move with the button up is a press whose release this page did not see.
    const onMove = (event) => {
        if (!(event.buttons & 1)) {
            listen(false);
            return phase === 'pressed' ? finished() : callOff();
        }
        x = event.clientX;
        y = event.clientY;
        if (phase === 'pressed') {
            if (Math.abs(y - down.clientY) < SLOP && Math.abs(x - down.clientX) < SLOP) return;
            held = begin(item, down, finished);
            if (!held) {
                listen(false);
                return finished();
            }
            phase = 'held';
            release = POINTER.capture(cursor);
            layer = OVERLAY.open({ modal: true, onDismiss: callOff });
            window.addEventListener('wheel', onWheel, { capture: true, passive: false });
            frame = requestAnimationFrame(scrollAtEdge);
        }
        if (phase === 'held') held.follow(x, y);
    };
    // The click that ends a drag is the drag's, not what is under it. Swallowed also when Escape put the thing
    // back while the button was still down.
    const onUp = (event) => {
        listen(false);
        if (phase === 'pressed') return finished();
        swallowClick();
        if (phase === 'held') settle(() => held.drop(event.clientX, event.clientY));
    };
    const onCancel = () => {
        listen(false);
        if (phase === 'pressed') return finished();
        swallowClick();
        callOff();
    };
    const onWheel = (event) => {
        const scroller = phase === 'held' && held.scroller?.(event.clientX, event.clientY);
        if (!scroller) return;
        event.preventDefault();
        const by = scroller.axis === 'x' ? event.deltaX : event.deltaY;
        scroller.element[SIDES[scroller.axis].offset] += by * (event.deltaMode === 1 ? LINE : 1);
        held.follow(x, y);
    };
    const scrollAtEdge = () => {
        frame = 0;
        if (phase !== 'held') return;
        const scroller = held.scroller?.(x, y);
        if (scroller) scrollNear(scroller, x, y, () => held.follow(x, y));
        frame = requestAnimationFrame(scrollAtEdge);
    };
    // A new press settles this one now: a press whose pointerup was lost is the case this is for.
    const gesture = {
        end: () => {
            listen(false);
            if (phase === 'pressed') finished();
            else if (phase === 'held') settle(() => (held.settleNow ? held.settleNow() : held.cancel()));
            else if (phase === 'settling') held.settleNow?.();
        },
    };
    gestures.set(area, gesture);
    listen(true);
}

function scrollNear({ element, axis }, x, y, moved) {
    const { start, end, offset } = SIDES[axis];
    const box = element.getBoundingClientRect();
    const at = axis === 'x' ? x : y;
    const by =
        at < box[start] + EDGE
            ? -(box[start] + EDGE - at) / 3
            : at > box[end] - EDGE
              ? (at - (box[end] - EDGE)) / 3
              : 0;
    if (!by) return;
    const before = element[offset];
    element[offset] = before + Math.max(-STEP_MAX, Math.min(STEP_MAX, by));
    if (element[offset] !== before) moved();
}

function swallowClick() {
    const swallow = (event) => {
        event.stopPropagation();
        event.preventDefault();
    };
    window.addEventListener('click', swallow, true);
    setTimeout(() => window.removeEventListener('click', swallow, true), 0);
}

export { SLOP, drag };
