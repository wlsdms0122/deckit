DeckitModule.define(
    'deckit/ui/component/part',
    {
        uses: [],
        provides: ['ROW_SIDE', 'waiting', 'busy', 'freed', 'hold', 'heldWhile', 'pressable', 'selectable'],
    },
    () => {
        // MARK: - Property
        // A section heading lines its icon up with the rows' icons by this.
        const ROW_SIDE = 8;
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

        function pressable(button, theme) {
            const { hover, pressed: press, focus } = theme.color;
            let over = false;
            let down = false;
            let rest = 'transparent'; // the background with no pointer on it
            const paint = () => {
                button.style.background = button.disabled ? 'transparent' : down ? press : over ? hover : rest;
            };
            button.addEventListener('mouseenter', () => {
                over = true;
                paint();
            });
            button.addEventListener('mouseleave', () => {
                over = down = false;
                paint();
            });
            button.addEventListener('mousedown', () => {
                down = true;
                paint();
            });
            button.addEventListener('mouseup', () => {
                down = false;
                paint();
            });
            button.addEventListener('focus', () => {
                if (button.matches(':focus-visible')) button.style.boxShadow = '0 0 0 2px ' + focus;
            });
            button.addEventListener('blur', () => {
                button.style.boxShadow = 'none';
            });
            button.repaint = paint;
            button.setRest = (color) => {
                rest = color || 'transparent';
                paint();
            };
            return button;
        }

        function selectable(element) {
            element.style.userSelect = 'text';
            return element;
        }

        // MARK: - Private
        return { ROW_SIDE, waiting, busy, freed, hold, heldWhile, pressable, selectable };
    }
);
