DeckitModule.define(
    'deckit/ui/component/part',
    { uses: [], provides: ['STYLE', 'waiting', 'busy', 'freed', 'hold', 'heldWhile', 'pressable', 'selectable'] },
    () => {
        // MARK: - Property
        const STYLE = `
            .deckit-pressable { transition: background-color var(--deckit-fast) var(--deckit-easing); }
            .deckit-pressable:hover { background: var(--deckit-hover); }
            .deckit-pressable:active { background: var(--deckit-pressed); }
            .deckit-pressable:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-pressable:disabled { background: transparent; }
        `;
        const waiting = new WeakMap(); // list -> the redraw it is waiting to run

        // MARK: - Initializer
        // MARK: - Public
        // A list is busy while a row of it is held (lifted, dragged, renamed) or leaving: a redraw asked for then
        // waits until it is free, and only the last one asked for runs.
        function busy(element) {
            return !!(
                element.matches?.('[data-deckit-held]') ||
                element.querySelector?.('[data-deckit-held], [data-deckit-leaving]')
            );
        }

        function freed(element) {
            for (let node = element; node; node = node.parentElement) {
                const draw = waiting.get(node);
                if (draw && !busy(node)) {
                    waiting.delete(node);
                    draw();
                }
            }
        }

        // Holds `element` until the returned release runs.
        function hold(element) {
            element.dataset.deckitHeld = '';
            return () => {
                delete element.dataset.deckitHeld;
                freed(element);
            };
        }

        // A drag's `begin` that holds `area` from the lift until the drag has played out.
        function heldWhile(area, begin) {
            return (item, down, finished) => {
                const release = hold(area);
                const drag = begin(item, down, () => {
                    release();
                    finished();
                });
                if (!drag) release();
                return drag;
            };
        }

        // Something pressed, washed under the pointer and ringed when the keyboard reaches it.
        function pressable(element) {
            element.classList.add('deckit-pressable');
            return element;
        }

        function selectable(element) {
            element.style.userSelect = 'text';
            return element;
        }

        // MARK: - Private
        return { STYLE, waiting, busy, freed, hold, heldWhile, pressable, selectable };
    }
);
