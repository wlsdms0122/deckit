DeckitModule.define(
    'deckit/ui/kit',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/color',
            'deckit/ui/icon',
            'deckit/ui/pointer',
            'deckit/ui/overlay',
            'deckit/ui/scroll',
            'deckit/ui/list/listbox',
            'deckit/ui/component/part',
            'deckit/ui/component/button',
            'deckit/ui/component/field',
            'deckit/ui/component/menu',
            'deckit/ui/component/section',
            'deckit/ui/component/popover',
            'deckit/ui/component/row',
            'deckit/ui/component/inline-edit',
            'deckit/ui/component/sortable',
            'deckit/ui/component/drag',
            'deckit/ui/component/file-tree',
            'deckit/ui/component/resizer',
            'deckit/ui/component/empty-state',
            'deckit/ui/component/loading',
            'deckit/ui/component/fonts',
            'deckit/ui/component/modal',
            'deckit/ui/component/quick-pick',
            'deckit/ui/component/color-picker',
            'deckit/ui/component/dialog',
        ],
        provides: ['make', 'addStyle'],
    },
    (TOKEN, COLOR, ICON, POINTER, OVERLAY, SCROLL, LISTBOX, PART, ...components) => {
        // MARK: - Property
        let installed = false;
        // MARK: - Initializer
        // MARK: - Public
        // The `ui` a page draws with, for `token`. Frozen all the way down: a plugin is handed the very objects its page
        // draws with. Components are made in the order of `uses`, as one may lend another something through `inner`.
        function make(token) {
            install(token);
            const ui = {};
            const inner = {};
            for (const component of components) Object.assign(ui, component.make(token, ui, inner));
            Object.assign(ui, {
                icon: ICON.icon,
                iconOf: ICON.iconOf,
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
