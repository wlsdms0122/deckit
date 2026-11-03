// The engine's type for the configuration's `font`, `default` for the theme's `mono`, and `size` in pixels, unset for
// the theme's text size. A face not among `faces` (chosen on another Mac) is the theme's. The line height is in whole
// pixels: a fractional one makes the selection layer drift off the lines.
function typefaceOf(engine, { font, size }, { faces, theme }) {
    const face = faces.find((candidate) => candidate.font && candidate.value === font)?.font;
    const px = size ?? theme.textSize;
    return engine.EditorView.theme({
        '&': { fontSize: px + 'px' },
        '.cm-scroller': {
            fontFamily: face ? `${face}, ${theme.mono}` : theme.mono,
            lineHeight: Math.round(px * 1.55) + 'px',
        },
    });
}

module.exports = { typefaceOf };
