DeckitModule.define(
    'deckit-ui/feature/app/page',
    {
        uses: [
            'deckit-ui/ui/token',
            'deckit-ui/ui/pointer',
            'deckit-ui/ui/overlay',
            'deckit-ui/ui/kit',
            'deckit-ui/service/style/page',
            'deckit-ui/feature/panel/page',
            'deckit-ui/feature/switcher/page',
            'deckit-ui/feature/app/protocol',
        ],
        provides: ['page', 'mod'],
    },
    (TOKEN, POINTER, OVERLAY, KIT, STYLE, PANEL, SWITCHER, PROTOCOL) => {
        // MARK: - Property
        const STYLES_PERMISSION = 'deckit.styles';

        // MARK: - Initializer
        // MARK: - Public
        // A page the UI made: the switcher's.
        function page(name) {
            if (name !== 'switcher') return;
            const theme = start();
            SWITCHER.boot(theme);
        }

        // What the UI gives a mod's page, as deck runs it (deckit/service/deck/page): the theme, the kit, `show()`,
        // and the registrations `view` and, with deckit.styles, `styles`. Once start() has ended, a view goes in the
        // panel's frame.
        function mod({ mod: running, chordOf, deliver, fail }) {
            const theme = start();
            const ui = KIT.make(theme);
            STYLE.wear();
            const styles = running.permissions.some(({ id }) => id === STYLES_PERMISSION);
            return {
                deck: { theme, ui, show: PANEL.show },
                kinds: { view: viewProblem, ...(styles ? { styles: stylesProblem } : {}) },
                holdsKeys: () => OVERLAY.layers.count() > 0,
                started(parts) {
                    const view = parts.view || null;
                    if (!view) {
                        for (const [action, key] of Object.entries(parts.keys || {}))
                            if (key && !key.global)
                                fail(
                                    `key "${action}" never runs: a mod with no view is never on screen, so only a global key does`
                                );
                    } else {
                        const tell = (name) =>
                            typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                        PANEL.mount({ theme, ui, view, tell, layers: OVERLAY.layers, chordOf });
                    }
                    const given = { ...(parts.styles || {}) };
                    return {
                        summary: { view: !!view, sidebar: !!view?.sidebar, styles: Object.keys(given) },
                        contributions: { styles: given },
                    };
                },
            };
        }

        // MARK: - Private
        // Every page the UI draws in starts the same: the pointer and what floats, in the app's theme.
        function start() {
            POINTER.start();
            OVERLAY.start();
            return TOKEN.tokenOf(PROTOCOL.setup.invoke().theme || TOKEN.FALLBACK_THEME);
        }

        function viewProblem(value) {
            return value?.content?.nodeType === Node.ELEMENT_NODE
                ? ''
                : 'takes { content, sidebar, didAppear, didDisappear }, content an element';
        }

        function stylesProblem(value) {
            if (!value || typeof value !== 'object') return 'takes { "<mod id>" or "*": css }';
            const wrong = Object.entries(value).find(([, css]) => typeof css !== 'string');
            return wrong ? `takes css text for "${wrong[0]}"` : '';
        }

        return { page, mod };
    }
);
