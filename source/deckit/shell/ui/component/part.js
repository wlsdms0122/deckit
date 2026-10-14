DeckitModule.define(
    'shell/ui/component/part',
    { uses: [], provides: ['STYLE', 'element', 'pressable', 'selectable', 'titleBar'] },
    () => {
        // MARK: - Property
        const STYLE = `
            .deckit-pressable { transition: background-color var(--deckit-fast) var(--deckit-easing); }
            .deckit-pressable:hover { background: var(--deckit-hover); }
            .deckit-pressable:active { background: var(--deckit-pressed); }
            .deckit-pressable:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-pressable:disabled { background: transparent; }
            .deckit-title-bar {
                box-sizing: border-box;
                min-height: var(--deckit-title-bar-area-height, 0px);
                margin-left: var(--deckit-title-bar-area-x, 0px);
                transition: margin-left var(--deckit-base) var(--deckit-easing);
            }
            [data-deckit-title-bar] .deckit-title-bar { -webkit-app-region: drag; }
            .deckit-title-bar :is(button, input, textarea, select, a[href], [role='button'], [tabindex], [contenteditable]) {
                -webkit-app-region: no-drag;
            }
        `;

        // MARK: - Initializer
        // MARK: - Public
        // An element: `className`, inline `style` and `text`.
        function element(tag, { className = '', style = {}, text = null } = {}) {
            const made = document.createElement(tag);
            if (className) made.className = className;
            Object.assign(made.style, style);
            if (text != null) made.textContent = text;
            return made;
        }

        // Something pressed, washed under the pointer and ringed when the keyboard reaches it.
        function pressable(element) {
            element.classList.add('deckit-pressable');
            return () => element.classList.remove('deckit-pressable');
        }

        // Text the person can select, in a page where nothing is by default.
        function selectable(element) {
            element.style.userSelect = 'text';
            return () => (element.style.userSelect = '');
        }

        // A bar along the top of the view, where the window's title bar may lie over it: at least as tall as the
        // bar, clear of the window's buttons, and dragging the window wherever nothing in it is pressed. A control the
        // kit does not know as one marks itself `-webkit-app-region: no-drag`.
        function titleBar(element) {
            element.classList.add('deckit-title-bar');
            return () => element.classList.remove('deckit-title-bar');
        }

        // MARK: - Private
        return { STYLE, element, pressable, selectable, titleBar };
    }
);
