DeckitModule.define('deckit/ui/overlay', { uses: [], provides: ['Z', 'start', 'raise', 'layers'] }, () => {
    // MARK: - Property
    // Above the page's own fixed layers.
    const Z = Object.freeze({ popover: 1150, modal: 1200 });
    // What floats, bottom first: a layer's place is also its height.
    const stack = [];
    let onChange = () => {};
    const layers = Object.freeze({
        top: () => stack.at(-1) || null,
        count: () => stack.length,
        onChange: (listener) => {
            onChange = listener;
        },
    });

    // MARK: - Initializer
    // MARK: - Public
    // A press outside the top layer's `contains` closes it, and the next, until one holds the press; a layer with no
    // `contains` holds every press. On pointerdown, so a control that cancels the mouse events after it (a resize
    // handle) still closes what is open.
    function start() {
        window.addEventListener('pointerdown', dismissOutside, true);
    }

    function raise(layer) {
        stack.push(layer);
        onChange(true);
        return {
            z: Z.modal + stack.length - 1,
            isTop: () => stack.at(-1) === layer,
            drop: () => drop(layer),
        };
    }

    // MARK: - Private
    function drop(layer) {
        const index = stack.indexOf(layer);
        if (index < 0) return;
        stack.splice(index, 1);
        onChange(stack.length > 0);
    }

    function dismissOutside(event) {
        for (let top = stack.at(-1); top?.contains && !top.contains(event.target); top = stack.at(-1)) {
            top.close();
            // A close that leaves its layer in (it was already on its way out) must not stop the walk.
            if (stack.at(-1) === top) drop(top);
        }
    }

    return { Z, start, raise, layers };
});
