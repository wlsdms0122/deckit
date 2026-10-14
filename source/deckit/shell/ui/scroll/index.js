DeckitModule.define('shell/ui/scroll', { uses: [], provides: ['scrollerOf', 'isFullyVisible', 'edgeFade'] }, () => {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // The nearest ancestor that scrolls vertically now, or null.
    function scrollerOf(element) {
        for (let node = element; node && node !== document.body && node !== document.documentElement; ) {
            const overflow = getComputedStyle(node).overflowY;
            if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
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
    return { scrollerOf, isFullyVisible, edgeFade };
});
