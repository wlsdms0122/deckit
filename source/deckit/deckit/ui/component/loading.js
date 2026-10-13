DeckitModule.define(
    'deckit/ui/component/loading',
    { uses: ['deckit/ui/token'], provides: ['STYLE', 'make'] },
    (TOKEN) => {
        // MARK: - Property
        const STYLE = `
        .deckit-spinner {
            display: inline-block;
            flex: 0 0 auto;
            box-sizing: border-box;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: var(--deckit-radius-round);
            opacity: 0.55;
        }
        .deckit-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 24px 12px;
            font: var(--deckit-type-body);
            text-align: center;
        }
        .deckit-loading-text { opacity: 0.6; }
    `;
        const TURN_MS = 750;

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return { spinner, loading };
        }

        // MARK: - Private
        // Still while the system asks for reduced motion.
        function spinner({ size = 14 } = {}) {
            const made = document.createElement('span');
            made.className = 'deckit-spinner';
            made.style.width = made.style.height = size + 'px';
            if (TOKEN.MOTION.base)
                made.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
                    duration: TURN_MS,
                    iterations: Infinity,
                });
            return { element: made };
        }

        function loading({ text = '' } = {}) {
            const box = document.createElement('div');
            box.className = 'deckit-loading';
            box.append(spinner({ size: 20 }).element);
            if (text) {
                const words = document.createElement('div');
                words.className = 'deckit-loading-text';
                words.textContent = text;
                box.append(words);
            }
            return { element: box };
        }

        return { STYLE, make };
    }
);
