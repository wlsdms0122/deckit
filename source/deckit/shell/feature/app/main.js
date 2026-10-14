DeckitModule.define(
    'shell/feature/app/main',
    {
        uses: [
            'shell/service/style/main',
            'shell/service/style/model/permission',
            'shell/feature/panel/main',
            'shell/feature/switcher/main',
            'shell/feature/app/protocol',
        ],
        provides: ['attach'],
    },
    (STYLE, STYLE_PERMISSION, PANEL, SWITCHER, PROTOCOL) => {
        // MARK: - Property
        // What the host app answers the shell: where it is shown is the app's.
        const ANSWERS = ['start', 'showsPanel', 'show', 'dismiss', 'summonSwitcher', 'panelTitled'];
        let deckit = null;
        let theme = null; // the app's, which every page the shell draws in derives its look from

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
                id: STYLE_PERMISSION.PERMISSION,
                name: 'Styles',
                icon: 'eye',
                means: "It can change how every page in the app looks, other mods' among them, and so read what they show.",
            });
            deckit.onStart(() => start(host));
        }

        // MARK: - Private
        function start(host) {
            PROTOCOL.setup.handle((_payload, sender) => {
                if (!deckit.mods.modOf(sender) && !deckit.pages.nameOf(sender))
                    throw Object.assign(new Error('only a deckit page draws'), { kind: 'REFUSED' });
                return { theme };
            });
            STYLE.start({ deckit });
            PANEL.start({ deckit, host });
            SWITCHER.start({ deckit, host });
            deckit.keymap.delegate({ isActive: PANEL.isActive, monitor: PANEL.monitor });
            host.start({
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
