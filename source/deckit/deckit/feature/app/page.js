DeckitModule.define(
    'deckit/feature/app/page',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/pointer',
            'deckit/ui/overlay',
            'deckit/ui/kit',
            'deckit/service/plugin/runtime',
            'deckit/feature/panel/page',
            'deckit/feature/panel/protocol',
            'deckit/feature/switcher/page',
            'deckit/feature/app/protocol',
        ],
        provides: ['boot'],
    },
    (TOKEN, POINTER, OVERLAY, UI, RUNTIME, PANEL, PANEL_PROTOCOL, SWITCHER, PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The entry of every page deckit makes: a plugin's, or the switcher's. `before` is the globals the page had
        // before deckit's bundle ran: what the bundle added goes, the registry first, so a plugin reaches deckit only
        // through what it is handed.
        function boot(before) {
            for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
            else start();
        }

        // MARK: - Private
        async function start() {
            POINTER.start();
            OVERLAY.start();
            const setup = PROTOCOL.setup.invoke();
            const theme = TOKEN.tokenOf(setup.theme || TOKEN.FALLBACK_THEME);
            if (setup.role === 'switcher') return SWITCHER.boot(theme);
            const ui = UI.make(theme);
            const { parts, tell } = await RUNTIME.start({
                theme,
                ui,
                layers: OVERLAY.layers,
                show: () => PANEL_PROTOCOL.show.send(),
                dismiss: () => PANEL_PROTOCOL.hide.send(),
            });
            if (parts?.content) PANEL.mount({ theme, ui, parts, tell });
        }

        return { boot };
    }
);
