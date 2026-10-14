DeckitModule.define('deckit-ui/ui/color', { uses: [], provides: ['rgbOf', 'isDark', 'mix', 'alpha'] }, () => {
    // MARK: - Property
    const DARK_LUMA = 140;

    // MARK: - Initializer
    // MARK: - Public
    // `#rgb`, `#rrggbb`, `rgb()` and `rgba()` as [red, green, blue]; anything else is null.
    function rgbOf(color) {
        const text = String(color || '').trim();
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
        if (hex) {
            const digits = hex[1].length === 3 ? hex[1].replace(/./g, (digit) => digit + digit) : hex[1];
            return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16));
        }
        const functional = /^rgba?\(([^)]+)\)$/.exec(text);
        if (!functional) return null;
        return functional[1]
            .split(',')
            .slice(0, 3)
            .map((channel) => parseFloat(channel));
    }

    function isDark(color) {
        const [red, green, blue] = rgbOf(color) || [0, 0, 0];
        return 0.299 * red + 0.587 * green + 0.114 * blue < DARK_LUMA;
    }

    // `amount` of `foreground` over `background`: 0 is the background, 1 the foreground.
    function mix(foreground, background, amount) {
        const over = rgbOf(foreground);
        const under = rgbOf(background);
        if (!over || !under) return foreground;
        const channels = over.map((channel, index) => Math.round(under[index] + (channel - under[index]) * amount));
        return `rgb(${channels.join(', ')})`;
    }

    function alpha(color, amount) {
        const channels = rgbOf(color);
        return channels ? `rgba(${channels.join(', ')}, ${amount})` : color;
    }

    // MARK: - Private
    return { rgbOf, isDark, mix, alpha };
});
