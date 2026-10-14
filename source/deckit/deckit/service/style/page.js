DeckitModule.define(
    'deckit/service/style/page',
    {
        uses: ['deckit/service/style/protocol'],
        provides: ['wear'],
        runs: 'page',
    },
    (PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The page wears the styles mods give it, as its last style sheets: a sheet the kit or the mod's entry adopts
        // later goes before them, so a mod's style wins over those at the same specificity. A style a page sets on an
        // element itself still wins over a sheet, as in any page. A sheet the page's own world adopts goes after them
        // until the styles next change.
        function wear() {
            const adopted = Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets');
            let worn = [];
            const others = () => adopted.get.call(document).filter((sheet) => !worn.includes(sheet));
            Object.defineProperty(document, 'adoptedStyleSheets', {
                configurable: true,
                get: () => adopted.get.call(document),
                set: (sheets) =>
                    adopted.set.call(document, [...sheets.filter((sheet) => !worn.includes(sheet)), ...worn]),
            });
            const show = (styles) => {
                const kept = others();
                worn = styles.map((css) => {
                    const sheet = new CSSStyleSheet();
                    sheet.replaceSync(css);
                    return sheet;
                });
                adopted.set.call(document, [...kept, ...worn]);
            };
            show(PROTOCOL.current.invoke());
            PROTOCOL.changed.on(({ styles }) => show(styles));
        }

        // MARK: - Private

        return { wear };
    }
);
