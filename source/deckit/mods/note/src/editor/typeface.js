// The text sizes a note is written in, as the choices of a string: `default` is the theme's, any other the size in
// pixels.
const TEXT_SIZES = [
    { const: 'default', title: 'Default' },
    ...Array.from({ length: 12 }, (_, index) => ({ const: String(11 + index), title: `${11 + index} px` })),
];

// A note's type for the configuration's `font` and `size`, each `default` for the theme's text font and size. A face
// not among `faces` (chosen on another Mac) is the theme's.
function typefaceOf({ font, size }, { faces, theme }) {
    const face = faces.find((candidate) => candidate.font && candidate.value === font)?.font;
    return {
        size: size === 'default' ? theme.textSize : Number(size),
        font: face ? `${face}, ${theme.textFont}` : theme.textFont,
    };
}

module.exports = { TEXT_SIZES, typefaceOf };
