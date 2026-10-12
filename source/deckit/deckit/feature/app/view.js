DeckitModule.define(
    'deckit/feature/app/view',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/pointer',
            'deckit/ui/overlay',
            'deckit/ui/kit',
            'deckit/service/plugin/runtime',
            'deckit/feature/panel/view',
            'deckit/feature/panel/model/protocol',
            'deckit/feature/switcher/view',
        ],
        provides: ['boot'],
    },
    (TOKEN, POINTER, OVERLAY, UI, RUNTIME, PANEL, PROTOCOL, SWITCHER) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The entry of every view deckit makes: a plugin's, or the switcher's. `before` is the globals the page had
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
            const { definition, parts, tell } = await RUNTIME.start({
                theme,
                ui,
                layers: OVERLAY.layers,
                show: () => PROTOCOL.show.send(),
                dismiss: () => PROTOCOL.hide.send(),
            });
            PROTOCOL.screen.send({ content: !!parts?.content, icon: String(definition?.icon || '') });
            if (parts?.content) PANEL.mount({ setup: { ...setup, theme }, ui, parts, tell });
        }

        return { boot };
    }
);
