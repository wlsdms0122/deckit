// MARK: - Property
const SIDES = Object.freeze({
    x: { overflow: 'overflowX', length: 'scrollWidth', shown: 'clientWidth' },
    y: { overflow: 'overflowY', length: 'scrollHeight', shown: 'clientHeight' },
});

// MARK: - Initializer
// MARK: - Public
// The nearest ancestor that scrolls along `axis` now, `x` or `y`, or null.
function scrollerOf(element, axis = 'y') {
    const { overflow, length, shown } = SIDES[axis];
    for (let node = element; node && node !== document.body && node !== document.documentElement; ) {
        const scrolls = getComputedStyle(node)[overflow];
        if ((scrolls === 'auto' || scrolls === 'scroll') && node[length] > node[shown]) return node;
        node = node.parentElement;
    }
    return null;
}

// Whether all of it is inside what scrolls it, or inside the window.
function isFullyVisible(element) {
    if (!element.isConnected || !element.getClientRects().length) return false;
    const box = scrollerOf(element.parentElement)?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight,
    };
    const own = element.getBoundingClientRect();
    return own.top >= box.top && own.bottom <= box.bottom;
}

// The scrolling box's own edges fade where there is more to scroll to. A mask, so it fades into whatever is behind
// the box, the panel's glass included. Returns the dispose.
function edgeFade(element, { size = 18 } = {}) {
    let frame = 0;
    const paint = () => {
        frame = 0;
        const top = Math.max(0, Math.min(size, element.scrollTop));
        const bottom = Math.max(0, Math.min(size, element.scrollHeight - element.clientHeight - element.scrollTop));
        element.style.maskImage =
            top || bottom
                ? `linear-gradient(to bottom, transparent 0, #000 ${top}px, #000 calc(100% - ${bottom}px), transparent 100%)`
                : 'none';
    };
    const soon = () => {
        if (!frame) frame = requestAnimationFrame(paint);
    };
    const resized = new ResizeObserver(soon);
    const changed = new MutationObserver(soon);
    element.addEventListener('scroll', soon, { passive: true });
    resized.observe(element);
    changed.observe(element, { childList: true, subtree: true });
    paint();
    return () => {
        cancelAnimationFrame(frame);
        element.removeEventListener('scroll', soon);
        resized.disconnect();
        changed.disconnect();
    };
}

// MARK: - Private
export { scrollerOf, isFullyVisible, edgeFade };
