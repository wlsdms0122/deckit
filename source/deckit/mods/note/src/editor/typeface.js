// A note's type for the configuration's `font`, `default` for the theme's text font, and `size` in pixels, unset for
// the theme's text size. A face not among `faces` (chosen on another Mac) is the theme's.
function typefaceOf({ font, size }, { faces, theme }) {
    const face = faces.find((candidate) => candidate.font && candidate.value === font)?.font;
    return {
        size: size ?? theme.textSize,
        font: face ? `${face}, ${theme.textFont}` : theme.textFont,
    };
}

module.exports = { typefaceOf };
