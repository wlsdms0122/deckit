// The text sizes a note is written in: `default` is the theme's.
const TEXT_SIZES = [
    { value: 'default', label: 'Default' },
    ...Array.from({ length: 12 }, (_, index) => ({ value: 11 + index, label: `${11 + index} px` })),
];

// A note's type for the settings' `font` and `size`, each `default` for the theme's text font and size. A face not
// among `faces` (chosen on another Mac) is the theme's.
function typefaceOf({ font, size }, { faces, theme }) {
    const face = faces.find((candidate) => candidate.font && candidate.value === font)?.font;
    return {
        size: typeof size === 'number' ? size : theme.textSize,
        font: face ? `${face}, ${theme.textFont}` : theme.textFont,
    };
}

module.exports = { TEXT_SIZES, typefaceOf };
