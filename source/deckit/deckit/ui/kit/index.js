DeckitModule.define(
    'deckit/ui/kit',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/kit/part',
            'deckit/ui/kit/component/button',
            'deckit/ui/kit/component/field',
            'deckit/ui/kit/component/menu',
            'deckit/ui/kit/component/section',
            'deckit/ui/kit/component/popover',
            'deckit/ui/kit/component/row',
            'deckit/ui/kit/component/inline-edit',
            'deckit/ui/kit/component/sortable',
            'deckit/ui/kit/component/drag',
            'deckit/ui/kit/component/resizer',
            'deckit/ui/kit/component/empty-state',
            'deckit/ui/kit/component/loading',
            'deckit/ui/kit/component/fonts',
            'deckit/ui/kit/component/modal',
            'deckit/ui/kit/component/color-picker',
            'deckit/ui/kit/component/dialog',
        ],
        provides: [
            'FALLBACK_THEME',
            'FOCUS_RING',
            'LIFT',
            'MOTION',
            'reducedMotion',
            'icon',
            'blend',
            'alpha',
            'grabPointer',
            'scrollFade',
            'make',
        ],
    },
    (T, K, ...parts) => {
        /* Frozen all the way down: plugins are handed the very objects the panel draws with, so a write
     would restyle the host and every other plugin. The constants are frozen in token.js. */
        const deepFreeze = (o) => {
            if (o && typeof o === 'object' && !Object.isFrozen(o)) {
                Object.freeze(o);
                for (const k of Object.getOwnPropertyNames(o)) {
                    const d = Object.getOwnPropertyDescriptor(o, k);
                    if (d && 'value' in d) deepFreeze(d.value);
                }
            }
            return o;
        };

        // In the order of `uses`: a component may lend another something through `inner`.
        const makeUI = (theme) => {
            const ui = {},
                inner = K.look(theme);
            for (const part of parts) Object.assign(ui, part.make(theme, ui, inner));
            return deepFreeze(
                Object.assign(ui, {
                    z: T.Z,
                    motion: T.MOTION,
                    accent: T.ACCENT,
                    tone: T.TONE,
                    wash: T.WASH,
                    play: T.play,
                    icon: T.icon,
                    grabPointer: T.grabPointer,
                    scrollFade: T.scrollFade,
                    selectable: T.selectable,
                    aimOnMove: T.aimOnMove,
                    inSight: K.inSight,
                    alpha: T.alpha,
                    blend: T.blend,
                    pressable: T.pressable,
                })
            );
        };

        return deepFreeze({
            // For the panel's own chrome, not for plugins.
            FALLBACK_THEME: T.FALLBACK_THEME,
            FOCUS_RING: T.FOCUS_RING,
            LIFT: T.LIFT,
            MOTION: T.MOTION,
            reducedMotion: T.reducedMotion,
            icon: T.icon,
            blend: T.blend,
            alpha: T.alpha,
            grabPointer: T.grabPointer,
            scrollFade: T.scrollFade,
            make: makeUI,
        });
    }
);
