DeckitModule.define(
    'shell/ui/kit',
    {
        uses: [
            'shell/ui/color',
            'shell/ui/icon',
            'shell/ui/pointer',
            'shell/ui/overlay',
            'shell/ui/scroll',
            'shell/ui/list/listbox',
            'shell/ui/component/part',
            'shell/ui/component/button',
            'shell/ui/component/field',
            'shell/ui/component/menu',
            'shell/ui/component/section',
            'shell/ui/component/popover',
            'shell/ui/component/row',
            'shell/ui/component/inline-edit',
            'shell/ui/component/sortable',
            'shell/ui/component/drag',
            'shell/ui/component/file-tree',
            'shell/ui/component/resizer',
            'shell/ui/component/empty-state',
            'shell/ui/component/loading',
            'shell/ui/component/fonts',
            'shell/ui/component/modal',
            'shell/ui/component/quick-pick',
            'shell/ui/component/color-picker',
            'shell/ui/component/dialog',
        ],
        provides: ['make', 'addStyle'],
    },
    (COLOR, ICON, POINTER, OVERLAY, SCROLL, LISTBOX, PART, ...components) => {
        // MARK: - Property
        let installed = false;
        // MARK: - Initializer
        // MARK: - Public
        // The `ui` a page draws with, for `theme`. Frozen all the way down: a mod is handed the very objects its page
        // draws with. Components are made in the order of `uses`, as one may lend another something through `inner`.
        function make(theme) {
            install();
            const ui = {};
            const inner = {};
            for (const component of components) Object.assign(ui, component.make(theme, ui, inner));
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
        // The kit's look, once per page: every part's rules, drawn with the theme's custom properties.
        function install() {
            if (installed) return;
            installed = true;
            const rules = [OVERLAY, PART, ...components].map((part) => part.STYLE);
            addStyle(rules.join('\n'));
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
