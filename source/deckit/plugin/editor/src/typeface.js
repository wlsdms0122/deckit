const MONOSPACED_FONTS = [
    { value: 'system', label: 'System (SF Mono)' },
    ...[
        'Menlo',
        'Monaco',
        'JetBrains Mono',
        'Fira Code',
        'Source Code Pro',
        'D2Coding',
        'Cascadia Code',
        'IBM Plex Mono',
        'Hack',
        'Inconsolata',
        'Roboto Mono',
        'Ubuntu Mono',
        'Courier New',
    ].map((name) => ({ value: name, label: name, font: `"${name}"` })),
];

// The engine's type for `size` and the setting's `font`, falling back to `mono`. The line height is in whole pixels: a
// fractional one makes the selection layer drift off the lines.
function typefaceOf(engine, { size, font, mono }) {
    const chosen = MONOSPACED_FONTS.find((face) => face.value === font)?.font;
    return engine.EditorView.theme({
        '&': { fontSize: size + 'px' },
        '.cm-scroller': {
            fontFamily: chosen ? `${chosen}, ${mono}` : mono,
            lineHeight: Math.round(size * 1.55) + 'px',
        },
    });
}

module.exports = { MONOSPACED_FONTS, typefaceOf };
