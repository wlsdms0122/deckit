DeckitModule.define(
    'deckit/feature/app/view',
    {
        uses: [
            'deckit/ui/kit',
            'deckit/service/web/client',
            'deckit/service/notify/client',
            'deckit/service/open/client',
            'deckit/module/chord',
            'deckit/feature/switcher/view',
            'deckit/service/switcher/client',
            'deckit/feature/panel/view',
            'deckit/feature/panel/model/protocol',
            'deckit/service/plugin/client',
        ],
        provides: ['boot'],
    },
    (UI, WEB, NOTIFY, OPEN, CHORD, LIST, ENTRIES, PANEL, PANEL_PROTOCOL, PLUGINS) => {
        // Asked synchronously so the page is built in one pass, with no repaint once the answer arrives.
        const setup = () => {
            try {
                return PANEL_PROTOCOL.setup.ask() || {};
            } catch {
                return {};
            }
        };

        // A second assembly would load every plugin a second time in the same page.
        let assembled = false;
        const assemble = () => {
            if (assembled) return;
            assembled = true;
            const said = setup();
            const theme = said.theme || UI.FALLBACK_THEME;
            if (said.role === 'switcher') return LIST.boot(theme);
            WEB.connect({ open: (url, options) => OPEN.open(url, options) });
            OPEN.listen();
            NOTIFY.listen();
            PLUGINS.listen();
            const ui = UI.make(theme);
            PLUGINS.load();
            const running = PLUGINS.build({ theme, ui }, { panel: { register: PANEL.register, reveal: PANEL.reveal } });
            PANEL.start({ theme, ui, shown: said.shown, look: said.look, onReorder: (ids) => PLUGINS.arrange(ids) });
            // Only after build, so every plugin's switcher source is registered before entries are answered.
            ENTRIES.listen();
            // What actually came up, which main compares with what it found on disk.
            PANEL_PROTOCOL.ready.send({ running });
        };

        return {
            boot(before) {
                /* Every global the bundle added goes before any plugin runs: the module registry would hand
         a plugin the plugin system itself, past its permissions and `requires`. */
                for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
                // Plain copies, not module views: a view throws on an unknown name, and a plugin expects undefined.
                window.DeckitUI = Object.freeze({ ...UI });
                window.DeckitChord = Object.freeze({ ...CHORD });
                if (document.readyState === 'loading')
                    document.addEventListener('DOMContentLoaded', assemble, { once: true });
                else assemble();
            },
        };
    }
);
