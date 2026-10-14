DeckitModule.define(
    'shell/feature/app/page',
    {
        uses: [
            'shell/ui/token',
            'shell/ui/pointer',
            'shell/ui/overlay',
            'shell/ui/kit',
            'shell/service/style/page',
            'shell/service/style/model/permission',
            'shell/feature/panel/page',
            'shell/feature/panel/region',
            'shell/feature/switcher/page',
            'shell/feature/switcher/model/page-name',
            'shell/feature/app/protocol',
        ],
        provides: ['page', 'mod'],
    },
    (TOKEN, POINTER, OVERLAY, KIT, STYLE, STYLE_PERMISSION, PANEL, REGION, SWITCHER, SWITCHER_PAGE, PROTOCOL) => {
        // MARK: - Property
        // Every page the shell draws in: clear around what it draws, and no drag selection, so text meant to be copied
        // opts in (ui.selectable).
        const PAGE_STYLE = `
            html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
            body { -webkit-user-select: none; user-select: none; }
        `;

        // MARK: - Initializer
        // MARK: - Public
        // A page the shell made: the switcher's.
        function page(name) {
            if (name !== SWITCHER_PAGE.PAGE_NAME) return;
            SWITCHER.boot(start());
        }

        // What the shell gives a mod's page, as deckit runs it (deckit/feature/mod/page): the theme, the kit, `show()`,
        // `region(element)`, and the registrations `view` and, with deckit.styles, `styles`. Once start() has ended, a
        // view goes in the panel's frame.
        function mod({ mod: running, chordOf, deliver }) {
            const theme = start();
            const ui = KIT.make(theme);
            STYLE.wear();
            const styles = running.permissions.some(({ id }) => id === STYLE_PERMISSION.PERMISSION);
            return {
                deck: { theme, ui, show: PANEL.show, region: REGION.make },
                mods: PANEL.listing,
                registrations: {
                    view: (value) => PANEL.viewProblem(value, running),
                    ...(styles ? { styles: STYLE.problemOf } : {}),
                },
                blocksKeys: () => OVERLAY.layers.count() > 0,
                keyProblem: (key, parts) => PANEL.keyProblem(key, parts.view),
                contribute(parts) {
                    const view = parts.view || null;
                    if (view) {
                        const tell = (name) =>
                            typeof view[name] === 'function' && deliver(`${name}()`, () => view[name]());
                        PANEL.mount({ theme, ui, view, tell, layers: OVERLAY.layers, chordOf });
                    }
                    const given = { ...(parts.styles || {}) };
                    return {
                        summary: {
                            view: !!view,
                            sidebar: !!view?.sidebar,
                            parent: view?.parent || null,
                            styles: Object.keys(given),
                        },
                        contributions: { styles: given },
                    };
                },
            };
        }

        // MARK: - Private
        // Every page the shell draws in starts the same: its look, the pointer and what floats, in the app's theme.
        function start() {
            KIT.addStyle(PAGE_STYLE);
            POINTER.start();
            OVERLAY.start();
            return TOKEN.tokenOf(PROTOCOL.setup.invoke().theme || TOKEN.FALLBACK_THEME);
        }

        return { page, mod };
    }
);
