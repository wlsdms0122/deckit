DeckitModule.define(
    'deckit/ui/kit',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/color',
            'deckit/ui/icon',
            'deckit/ui/motion',
            'deckit/ui/pointer',
            'deckit/ui/overlay',
            'deckit/ui/scroll',
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
            'deckit/ui/component/resizer',
            'deckit/ui/component/empty-state',
            'deckit/ui/component/loading',
            'deckit/ui/component/fonts',
            'deckit/ui/component/modal',
            'deckit/ui/component/color-picker',
            'deckit/ui/component/dialog',
        ],
        provides: ['make'],
    },
    (TOKEN, COLOR, ICON, MOTION, POINTER, OVERLAY, SCROLL, PART, ...components) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The `ui` a page draws with. Frozen all the way down: a plugin is handed the very objects its page draws with.
        // Components are made in the order of `uses`, as one may lend another something through `inner`.
        function make(theme) {
            const ui = {};
            const inner = PART.look(theme);
            for (const component of components) Object.assign(ui, component.make(theme, ui, inner));
            Object.assign(ui, {
                motion: TOKEN.MOTION,
                accent: TOKEN.ACCENT,
                tone: TOKEN.TONE,
                wash: TOKEN.WASH,
                icon: ICON.icon,
                alpha: COLOR.alpha,
                blend: COLOR.mix,
                grabPointer: POINTER.capture,
                aimOnMove: POINTER.hoverIntent,
                scrollFade: SCROLL.edgeFade,
                inSight: SCROLL.isFullyVisible,
                pressable: PART.pressable,
                selectable: PART.selectable,
            });
            return deepFreeze(ui);
        }

        // MARK: - Private
        function deepFreeze(value) {
            if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
            Object.freeze(value);
            for (const key of Object.getOwnPropertyNames(value)) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if ('value' in descriptor) deepFreeze(descriptor.value);
            }
            return value;
        }

        return { make };
    }
);
