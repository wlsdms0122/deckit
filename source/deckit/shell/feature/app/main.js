DeckitModule.define(
    'shell/feature/app/main',
    {
        uses: [
            'shell/service/style/main',
            'shell/service/style/model/permission',
            'shell/feature/region/main',
            'shell/feature/panel/main',
            'shell/feature/switcher/main',
            'shell/feature/theme/main',
        ],
        provides: ['attach'],
    },
    (STYLE, STYLE_PERMISSION, REGION, PANEL, SWITCHER, THEME) => {
        // MARK: - Property
        // What the host app answers the shell: where it is shown is the app's.
        const ANSWERS = ['start', 'showsPanel', 'show', 'dismiss', 'summonSwitcher', 'panelTitled'];
        let deckit = null;

        // MARK: - Initializer
        // MARK: - Public
        // How a host app puts deckit's shell on deckit, once, before it is ready: `deckit` is what connect answered,
        // and `host` answers where the shell is shown. The shell starts with deckit, before any mod launches.
        function attach(given, { host } = {}) {
            if (deckit) throw new Error('[deckit] attach is called once');
            const missing = ANSWERS.filter((name) => typeof host?.[name] !== 'function');
            if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
            deckit = given;
            deckit.permissions.define({
                id: STYLE_PERMISSION.STYLES,
                name: 'Styles',
                icon: 'eye',
                means: "It can change how every page in the app looks, other mods' among them, and so read what they show.",
            });
            deckit.onStart(() => start(host));
        }

        // MARK: - Private
        function start(host) {
            THEME.start({ draws: (sender) => !!deckit.mods.modOf(sender) || !!deckit.pages.nameOf(sender) });
            STYLE.start({ deckit });
            REGION.start({ deckit });
            PANEL.start({ deckit, host });
            SWITCHER.start({ deckit, host });
            deckit.keymap.delegate({ isActive: PANEL.isActive, monitor: PANEL.monitor });
            host.start({ setTheme: THEME.set, panel: PANEL.control, switcher: SWITCHER.control });
        }

        return { attach };
    }
);
