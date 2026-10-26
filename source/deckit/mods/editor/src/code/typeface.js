// The font sizes a file is shown in: `default` is the theme's text size.
const FONT_SIZES = [
    { value: 'default', label: 'Default' },
    ...Array.from({ length: 15 }, (_, index) => ({ value: 10 + index, label: `${10 + index} px` })),
];

// The engine's type for the settings' `font` and `size`, each `default` for the theme's `mono` and text size. A face
// not among `faces` (chosen on another Mac) is the theme's. The line height is in whole pixels: a fractional one makes
// the selection layer drift off the lines.
function typefaceOf(engine, { font, size }, { faces, theme }) {
    const face = faces.find((candidate) => candidate.font && candidate.value === font)?.font;
    const px = typeof size === 'number' ? size : theme.textSize;
    return engine.EditorView.theme({
        '&': { fontSize: px + 'px' },
        '.cm-scroller': {
            fontFamily: face ? `${face}, ${theme.mono}` : theme.mono,
            lineHeight: Math.round(px * 1.55) + 'px',
        },
    });
}

module.exports = { FONT_SIZES, typefaceOf };
