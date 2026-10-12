DeckitModule.define(
    'deckit/ui/token',
    { uses: ['deckit/ui/color'], provides: ['FALLBACK_THEME', 'MOTION', 'tokenOf'] },
    (COLOR) => {
        // MARK: - Property
        // Worn until the embedder gives its theme.
        const FALLBACK_THEME = Object.freeze({
            sidebarBg: 'rgb(16, 18, 20)',
            sidebarColor: '#fff',
            border: '1px solid rgba(121,124,129,.3)',
            contentBg: '#1a1d21',
            contentColor: '#d1d2d3',
            font: '-apple-system, system-ui, sans-serif',
        });
        // Lengths in ms, read at each use: 0 while the system asks for reduced motion.
        const MOTION = Object.freeze({
            get fast() {
                return reducedMotion() ? 0 : 110;
            },
            get base() {
                return reducedMotion() ? 0 : 170;
            },
            get slow() {
                return reducedMotion() ? 0 : 260;
            },
            easing: 'cubic-bezier(.2,.7,.3,1)',
            // Where a panel or a modal arrives from and leaves to.
            entrance: 'translateY(6px) scale(.99)',
        });
        const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
        const TYPE = { caption: 11, small: 12, body: 13, medium: 14, large: 15, heading: 16, title: 18 };
        // A neutral grey over any background, light or dark.
        const WASH = (amount) => `rgba(128,128,128,${amount})`;

        // MARK: - Initializer
        // MARK: - Public
        // What every view draws with, derived once from the embedder's theme.
        function tokenOf(theme) {
            const text = theme.contentColor;
            const background = theme.contentBg;
            const toward = (amount) => COLOR.mix(text, background, amount);
            return deepFreeze({
                dark: COLOR.isDark(background),
                font: theme.font,
                mono: MONO,
                type: Object.fromEntries(Object.entries(TYPE).map(([name, size]) => [name, `${size}px ${theme.font}`])),
                border: theme.border,
                color: {
                    text,
                    muted: toward(0.62),
                    disabled: toward(0.3),
                    background,
                    surface: toward(0.06),
                    lifted: toward(0.1),
                    divider: WASH(0.22),
                    fill: WASH(0.12),
                    hover: WASH(0.14),
                    selected: WASH(0.22),
                    pressed: WASH(0.3),
                    accent: '#4b8bf4',
                    onAccent: '#fff',
                    ok: '#2eb67d',
                    warn: '#ecb22e',
                    alert: '#e01e5a',
                    focus: 'rgba(124,160,255,.7)',
                    scrim: 'rgba(0,0,0,.45)',
                    folder: '#5aa9e6',
                },
                radius: { small: 4, control: 6, medium: 8, large: 10, card: 12, round: 999 },
                shadow: {
                    raised: '0 10px 32px rgba(0,0,0,.32)',
                    nested: '0 14px 40px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.28)',
                    modal: '0 18px 48px rgba(0,0,0,.4)',
                    lifted: '0 8px 22px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.2)',
                },
                motion: MOTION,
            });
        }

        // MARK: - Private
        function reducedMotion() {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }

        function deepFreeze(value) {
            if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
            for (const key of Object.keys(value)) deepFreeze(value[key]);
            return Object.freeze(value);
        }

        return { FALLBACK_THEME, MOTION, tokenOf };
    }
);
