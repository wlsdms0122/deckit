// MARK: - Property
const DARK_LUMA = 140;
// The inks text is drawn in over a colour of the content's own: the one that stands out from it more.
const INKS = Object.freeze(['#ffffff', '#1d1c1d']);

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

// The ink to draw text or a glyph in over `color`, a colour of the content's own (a calendar's): of white and a
// near black, the one with the greater contrast against it.
function onColor(color) {
    const under = luminanceOf(color);
    if (under === null) return INKS[0];
    const contrast = (ink) => {
        const [lighter, darker] = [luminanceOf(ink), under].sort((a, b) => b - a);
        return (lighter + 0.05) / (darker + 0.05);
    };
    return contrast(INKS[0]) >= contrast(INKS[1]) ? INKS[0] : INKS[1];
}

function alpha(color, amount) {
    const channels = rgbOf(color);
    return channels ? `rgba(${channels.join(', ')}, ${amount})` : color;
}

// MARK: - Private
// The relative luminance of a colour, from 0 for black to 1 for white, or null when it cannot be read.
function luminanceOf(color) {
    const channels = rgbOf(color);
    if (!channels) return null;
    const [red, green, blue] = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export { rgbOf, isDark, mix, alpha, onColor };
