DeckitModule.define('deckit/ui/motion', { uses: [], provides: ['play'] }, () => {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A transition from `from` to `to`. The start is read back before the end is written, or both land in one style
    // pass and nothing transitions; a frame in between is not enough.
    function play(element, from, to) {
        Object.assign(element.style, from);
        void element.offsetHeight;
        Object.assign(element.style, to);
    }

    // MARK: - Private
    return { play };
});
