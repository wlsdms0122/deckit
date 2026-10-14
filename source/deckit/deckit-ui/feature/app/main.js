DeckitModule.define(
    'deckit-ui/feature/app/main',
    {
        uses: [
            'deckit-ui/service/style/main',
            'deckit-ui/feature/panel/main',
            'deckit-ui/feature/switcher/main',
            'deckit-ui/feature/app/protocol',
        ],
        provides: ['attach'],
    },
    (STYLE, PANEL, SWITCHER, PROTOCOL) => {
        // MARK: - Property
        // What a shell answers the UI: where it is shown is the app's.
        const ANSWERS = ['start', 'showsPanel', 'reveal', 'dismiss', 'summonSwitcher', 'panelTitled'];
        let deckit = null;
        let theme = null; // the app's, which every page the UI draws in derives its look from

        // MARK: - Initializer
        // MARK: - Public
        // How an app puts deckit's UI on deck, once, before it is ready: `deckit` is what connect answered, and
        // `shell` answers where the UI is shown. The UI starts with deck, before any mod launches.
        function attach(given, { shell } = {}) {
            if (deckit) throw new Error('[deckit] attach is called once');
            const missing = ANSWERS.filter((name) => typeof shell?.[name] !== 'function');
            if (missing.length) throw new Error(`[deckit] the shell does not answer ${missing.join(', ')}`);
            deckit = given;
            deckit.onStart(() => start(shell));
        }

        // MARK: - Private
        function start(shell) {
            PROTOCOL.setup.handle((_payload, sender) => {
                if (!deckit.mods.modOf(sender) && !deckit.pages.nameOf(sender))
                    throw Object.assign(new Error('only a deckit page draws'), { kind: 'REFUSED' });
                return { theme };
            });
            STYLE.start({ deckit });
            PANEL.start({ deckit, shell });
            SWITCHER.start({ deckit, shell });
            deckit.keymap.route({ shown: PANEL.shows, monitor: PANEL.monitor });
            shell.start({
                setTheme,
                panel: PANEL.control,
                switcher: SWITCHER.control,
                window: deckit.window,
                keymap: { listen: deckit.keymap.listen },
            });
        }

        // A new theme makes every page again, which draws in it from the start.
        function setTheme(next) {
            if (JSON.stringify(next) === JSON.stringify(theme)) return;
            theme = next;
            deckit.mods.relaunchAll();
            SWITCHER.reload();
        }

        return { attach };
    }
);
