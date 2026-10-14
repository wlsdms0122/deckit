DeckitModule.define(
    'deckit-ui/ui/kit',
    {
        uses: [
            'deckit-ui/ui/token',
            'deckit-ui/ui/color',
            'deckit-ui/ui/icon',
            'deckit-ui/ui/pointer',
            'deckit-ui/ui/overlay',
            'deckit-ui/ui/scroll',
            'deckit-ui/ui/list/listbox',
            'deckit-ui/ui/component/part',
            'deckit-ui/ui/component/button',
            'deckit-ui/ui/component/field',
            'deckit-ui/ui/component/menu',
            'deckit-ui/ui/component/section',
            'deckit-ui/ui/component/popover',
            'deckit-ui/ui/component/row',
            'deckit-ui/ui/component/inline-edit',
            'deckit-ui/ui/component/sortable',
            'deckit-ui/ui/component/drag',
            'deckit-ui/ui/component/file-tree',
            'deckit-ui/ui/component/resizer',
            'deckit-ui/ui/component/empty-state',
            'deckit-ui/ui/component/loading',
            'deckit-ui/ui/component/fonts',
            'deckit-ui/ui/component/modal',
            'deckit-ui/ui/component/quick-pick',
            'deckit-ui/ui/component/color-picker',
            'deckit-ui/ui/component/dialog',
        ],
        provides: ['make', 'addStyle'],
    },
    (TOKEN, COLOR, ICON, POINTER, OVERLAY, SCROLL, LISTBOX, PART, ...components) => {
        // MARK: - Property
        let installed = false;
        // MARK: - Initializer
        // MARK: - Public
        // The `ui` a page draws with, for `token`. Frozen all the way down: a mod is handed the very objects its page
        // draws with. Components are made in the order of `uses`, as one may lend another something through `inner`.
        function make(token) {
            install(token);
            const ui = {};
            const inner = {};
            for (const component of components) Object.assign(ui, component.make(token, ui, inner));
            Object.assign(ui, {
                icon: ICON.icon,
                iconOf: ICON.iconOf,
                sanitizeIcon: ICON.sanitize,
                element: PART.element,
                addStyle,
                listbox: LISTBOX.listbox,
                alpha: COLOR.alpha,
                mix: COLOR.mix,
                capturePointer: POINTER.capture,
                edgeFade: SCROLL.edgeFade,
                isFullyVisible: SCROLL.isFullyVisible,
                pressable: PART.pressable,
                selectable: PART.selectable,
                titleBar: PART.titleBar,
            });
            return deepFreeze(ui);
        }

        // Rules of a view of deckit's own, drawn with the kit's custom properties.
        function addStyle(rules) {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(rules);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }

        // MARK: - Private
        // The kit's look, once per page: the token's values as custom properties, then every part's rules.
        function install(token) {
            if (installed) return;
            installed = true;
            const rules = [OVERLAY, PART, ...components].map((part) => part.STYLE);
            addStyle(TOKEN.propertiesOf(token) + rules.join('\n'));
        }

        function deepFreeze(value) {
            if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
            Object.freeze(value);
            for (const key of Object.getOwnPropertyNames(value)) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if ('value' in descriptor) deepFreeze(descriptor.value);
            }
            return value;
        }

        return { make, addStyle };
    }
);
