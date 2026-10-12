DeckitModule.define(
    'deckit/ui/overlay',
    { uses: ['deckit/ui/token'], provides: ['Z', 'STYLE', 'start', 'open', 'place', 'layers'] },
    (TOKEN) => {
        // MARK: - Property
        // Above the page's own fixed things. A float (a toolbar, an autocomplete) is placed by its owner and answers
        // nothing; a layer is above every float, by its place in the stack; what a drag carries is above them all.
        const Z = Object.freeze({ float: 1150, layer: 1200, drag: 2147483646 });
        // How far inside the window a placed box stays.
        const MARGIN = 8;
        // How far a submenu overlaps the menu it opens from.
        const OVERLAP = 6;
        const STYLE = `
            .deckit-surface {
                position: fixed;
                transition: opacity var(--deckit-fast) var(--deckit-easing), transform var(--deckit-base) var(--deckit-easing);
            }
            .deckit-surface[data-side='bottom'] { transform-origin: top left; }
            .deckit-surface[data-side='top'] { transform-origin: bottom left; }
            .deckit-surface[data-side='right'] { transform-origin: top left; }
            .deckit-surface[data-side='left'] { transform-origin: top right; }
            .deckit-surface[data-state='closed'] { opacity: 0; pointer-events: none; }
            .deckit-surface[data-state='closed'][data-side='bottom'] { transform: translateY(-6px) scale(.96); }
            .deckit-surface[data-state='closed'][data-side='top'] { transform: translateY(6px) scale(.96); }
            .deckit-surface[data-state='closed'][data-side='right'] { transform: translateX(-6px) scale(.96); }
            .deckit-surface[data-state='closed'][data-side='left'] { transform: translateX(6px) scale(.96); }
        `;
        // What floats and is dismissed, bottom first.
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
        // On pointerdown, so a control that cancels the mouse events after it (a resize handle) still dismisses what is
        // open. Keys are the top layer's first, in the capture phase, before the page sees them.
        function start() {
            window.addEventListener('pointerdown', dismissOutside, true);
            window.addEventListener('keydown', route, true);
            window.addEventListener('scroll', dismissScrolledAway, true);
            window.addEventListener('resize', dismissTransient);
            window.addEventListener('blur', dismissTransient);
        }

        // Opens a layer: `element` (optional) goes on the page, placed by `anchor`, `rect`, `point` or `beside`.
        // - A press outside the layer and what it hangs from dismisses it, then the next layer, until one holds the
        //   press. A `modal` layer holds every press.
        // - A key goes to `onKey` first; one it does not take (it returns falsy) that is Escape dismisses the layer.
        // - A `transient` layer is also dismissed by a scroll outside it, a resize and the window losing focus.
        // - Dismissing calls `onDismiss`; `close()` plays the exit and takes the element away.
        function open({
            element = null,
            anchor = null,
            rect = null,
            point = null,
            beside = null,
            gap = 4,
            modal = false,
            transient = false,
            contains = () => false,
            speed = 'fast',
            onKey = () => false,
            onDismiss,
        }) {
            const layer = {
                element,
                z: Z.layer + stack.length,
                modal,
                transient,
                isTop: () => stack.at(-1) === layer,
                holds: (target) =>
                    !!element?.contains(target) ||
                    !!anchor?.contains(target) ||
                    !!beside?.contains(target) ||
                    contains(target),
                onKey,
                dismiss: () => onDismiss(),
                place: () =>
                    (anchor || rect || point || beside) && place(element, { anchor, rect, point, beside, gap }),
                close: () => close(layer, speed),
            };
            stack.push(layer);
            onChange(true);
            if (element) show(element, layer);
            return layer;
        }

        // Places a fixed box against a target, kept MARGIN inside the window, and returns the side it went to.
        // - `anchor` (an element) or `rect`: below it, or above when only that fits. `align` is `start` or `center`.
        // - `point`: at it, or above it.
        // - `beside` (a row of a menu): right of the menu, overlapping it, or left of it when only that fits.
        // `prefer` puts a box above its target first.
        function place(
            element,
            { anchor = null, rect = null, point = null, beside = null, gap = 4, align = 'start', prefer = 'bottom' }
        ) {
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            let x;
            let y;
            let side;
            if (beside) {
                const row = beside.getBoundingClientRect();
                const menu = beside.parentElement.getBoundingClientRect();
                side = menu.right - OVERLAP + width > window.innerWidth - MARGIN ? 'left' : 'right';
                x = side === 'right' ? menu.right - OVERLAP : menu.left + OVERLAP - width;
                y = row.top - 4;
            } else if (anchor || rect) {
                const box = rect || anchor.getBoundingClientRect();
                const below = box.bottom + gap;
                const above = box.top - gap - height;
                const fitsBelow = below + height <= window.innerHeight - MARGIN;
                const fitsAbove = above >= MARGIN;
                side =
                    prefer === 'top'
                        ? fitsAbove || !fitsBelow
                            ? 'top'
                            : 'bottom'
                        : fitsBelow || !fitsAbove
                          ? 'bottom'
                          : 'top';
                x = align === 'center' ? (box.left + box.right) / 2 - width / 2 : box.left;
                y = side === 'bottom' ? below : above;
            } else {
                side = point.y + height > window.innerHeight - MARGIN ? 'top' : 'bottom';
                x = point.x;
                y = side === 'bottom' ? point.y : point.y - height;
            }
            element.style.left = clamp(x, MARGIN, window.innerWidth - width - MARGIN) + 'px';
            element.style.top = clamp(y, MARGIN, window.innerHeight - height - MARGIN) + 'px';
            element.dataset.side = side;
            return side;
        }

        // MARK: - Private
        // The box arrives from its closed state: laid out closed first, or both states land in one style pass.
        function show(element, layer) {
            element.classList.add('deckit-surface');
            element.dataset.state = 'closed';
            element.style.zIndex = String(layer.z);
            document.body.append(element);
            layer.place();
            void element.offsetHeight;
            element.dataset.state = 'open';
        }

        function close(layer, speed) {
            const index = stack.indexOf(layer);
            if (index < 0) return;
            stack.splice(index, 1);
            onChange(stack.length > 0);
            const { element } = layer;
            if (!element) return;
            element.dataset.state = 'closed';
            const length = TOKEN.MOTION[speed];
            if (length) setTimeout(() => element.dataset.state === 'closed' && element.remove(), length);
            else element.remove();
        }

        function dismissOutside(event) {
            for (const layer of [...stack].reverse()) {
                if (layer.modal || layer.holds(event.target)) return;
                layer.dismiss();
            }
        }

        function route(event) {
            const top = stack.at(-1);
            if (!top) return;
            if (top.onKey(event)) {
                event.preventDefault();
                event.stopPropagation();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                top.dismiss();
            }
        }

        // A box placed against something that scrolled away points at nothing.
        function dismissScrolledAway(event) {
            for (const layer of [...stack].reverse()) {
                if (layer.transient && !layer.element?.contains(event.target)) layer.dismiss();
            }
        }

        function dismissTransient() {
            for (const layer of [...stack].reverse()) if (layer.transient) layer.dismiss();
        }

        function clamp(value, low, high) {
            return Math.max(low, Math.min(value, high));
        }

        return { Z, STYLE, start, open, place, layers };
    }
);
