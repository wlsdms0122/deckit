DeckitModule.define('deckit/ui/component/part', { uses: [], provides: ['STYLE', 'pressable', 'selectable'] }, () => {
    // MARK: - Property
    const STYLE = `
            .deckit-pressable { transition: background-color var(--deckit-fast) var(--deckit-easing); }
            .deckit-pressable:hover { background: var(--deckit-hover); }
            .deckit-pressable:active { background: var(--deckit-pressed); }
            .deckit-pressable:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-pressable:disabled { background: transparent; }
        `;

    // MARK: - Initializer
    // MARK: - Public
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

    // MARK: - Private
    return { STYLE, pressable, selectable };
});
