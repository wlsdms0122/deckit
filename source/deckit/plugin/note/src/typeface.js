// "system" is the face the rest of the panel is in.
const FONTS = [
    { value: 'system', label: 'System' },
    ...[
        'Apple SD Gothic Neo',
        'Pretendard',
        'Noto Sans KR',
        'Spoqa Han Sans Neo',
        'Nanum Gothic',
        'Nanum Myeongjo',
        'Helvetica Neue',
        'Avenir Next',
        'Inter',
        'IBM Plex Sans',
        'Georgia',
        'Charter',
        'Palatino',
    ].map((name) => ({ value: name, label: name, font: `"${name}"` })),
];

// A face not in the list (chosen on another Mac) falls back to `fallback`.
function typefaceOf({ font, size }, fallback) {
    const face = FONTS.find((candidate) => candidate.value === font)?.font;
    return { size, font: face ? `${face}, ${fallback}` : fallback };
}

module.exports = { FONTS, typefaceOf };
