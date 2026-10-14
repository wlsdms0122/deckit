DeckitModule.define(
    'shell/ui/motion',
    { uses: ['shell/ui/token'], provides: ['play', 'collapse', 'expand', 'finish'] },
    (TOKEN) => {
        // MARK: - Property
        // What a fold sets inline, as the element had it before: put back once the fold is over.
        const FOLDED = ['transition', 'overflow', 'opacity', 'pointerEvents'];
        const folding = new Map(); // element -> { inline, timer, then }: a fold under way

        // MARK: - Initializer
        // MARK: - Public
        // A transition from `from` to `to`. The start is read back before the end is written, or both land in one style
        // pass and nothing transitions; a frame in between is not enough.
        function play(element, from, to) {
            Object.assign(element.style, from);
            void element.offsetHeight;
            Object.assign(element.style, to);
        }

        // Folds `element` away along an axis, to nothing, and runs `then` once it has. `across` folds its width rather
        // than its height. A fold under way is taken over from where it stands.
        function collapse(element, { across = false } = {}, then = null) {
            const axis = axisOf(across);
            const from = element.getBoundingClientRect()[axis.size];
            const opacity = getComputedStyle(element).opacity;
            settle(element);
            const length = TOKEN.MOTION.fast;
            if (!length || !from) return then?.();
            fold(element, axis, length, then, {
                from: { [axis.size]: from + 'px', opacity },
                to: { [axis.size]: '0px', opacity: '0', [axis.start]: '0', [axis.end]: '0' },
            });
        }

        // Unfolds `element` along an axis from nothing to its own size and opacity: the reverse of `collapse`, from
        // where a fold under way stands.
        function expand(element, { across = false } = {}) {
            const axis = axisOf(across);
            const running = folding.has(element);
            const from = running ? element.getBoundingClientRect()[axis.size] : 0;
            const opacity = running ? getComputedStyle(element).opacity : '0';
            settle(element);
            const length = TOKEN.MOTION.fast;
            const to = element.getBoundingClientRect()[axis.size];
            if (!length || !to) return;
            const style = getComputedStyle(element);
            fold(element, axis, length, null, {
                from: { [axis.size]: from + 'px', opacity, [axis.start]: '0', [axis.end]: '0' },
                to: {
                    [axis.size]: to + 'px',
                    opacity: style.opacity,
                    [axis.start]: style[axis.start],
                    [axis.end]: style[axis.end],
                },
            });
        }

        // A fold under way ends at once, as it would have: its `then` runs.
        function finish(element) {
            const then = folding.get(element)?.then;
            settle(element);
            then?.();
        }

        // MARK: - Private
        function axisOf(across) {
            return across
                ? { size: 'width', minSize: 'minWidth', start: 'marginLeft', end: 'marginRight' }
                : { size: 'height', minSize: 'minHeight', start: 'marginTop', end: 'marginBottom' };
        }

        function fold(element, axis, length, then, { from, to }) {
            const names = [...FOLDED, axis.size, axis.minSize, axis.start, axis.end];
            const inline = Object.fromEntries(names.map((name) => [name, element.style[name]]));
            play(
                element,
                { ...from, transition: 'none', [axis.minSize]: '0', overflow: 'hidden', pointerEvents: 'none' },
                {
                    ...to,
                    transition: [axis.size, 'opacity', 'margin']
                        .map((property) => `${property} ${length}ms ${TOKEN.MOTION.easing}`)
                        .join(', '),
                }
            );
            const timer = setTimeout(() => {
                settle(element);
                then?.();
            }, length);
            folding.set(element, { inline, timer, then });
        }

        // A fold under way stops, its `then` not run, and the element's inline style is put back as it was before it.
        function settle(element) {
            const running = folding.get(element);
            if (!running) return;
            clearTimeout(running.timer);
            folding.delete(element);
            Object.assign(element.style, running.inline);
        }

        return { play, collapse, expand, finish };
    }
);
