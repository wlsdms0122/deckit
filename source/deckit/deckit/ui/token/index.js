DeckitModule.define(
    'deckit/ui/token',
    {
        uses: [],
        provides: ['FALLBACK_THEME', 'FOCUS_RING', 'ACCENT', 'TONE', 'WASH', 'LIFT', 'MOTION', 'reducedMotion'],
    },
    () => {
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
        const FOCUS_RING = 'rgba(124,160,255,.7)';
        const ACCENT = '#4b8bf4';
        const TONE = Object.freeze({ ok: '#2eb67d', warn: '#ecb22e', alert: '#e01e5a' });
        const WASH = Object.freeze({ hover: 'rgba(128,128,128,.14)', cursor: 'rgba(128,128,128,.22)' });
        // Where a panel or a modal arrives from and leaves to.
        const LIFT = 'translateY(6px) scale(.99)';
        // Read at each use, so a change of the system setting takes effect at once.
        const MOTION = Object.freeze({
            get fast() {
                return reducedMotion() ? '0ms' : '110ms';
            },
            get base() {
                return reducedMotion() ? '0ms' : '170ms';
            },
            get slow() {
                return reducedMotion() ? '0ms' : '260ms';
            },
            ease: 'cubic-bezier(.2,.7,.3,1)',
        });

        // MARK: - Initializer
        // MARK: - Public
        function reducedMotion() {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }

        // MARK: - Private
        return { FALLBACK_THEME, FOCUS_RING, ACCENT, TONE, WASH, LIFT, MOTION, reducedMotion };
    }
);
