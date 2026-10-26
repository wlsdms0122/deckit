// MARK: - Property
// Letters whose widths differ from face to face.
const PROBE = 'mmmmmmmmmmlli1|WW@#';
// The faces offered for text a person reads and writes, and the fixed-width ones, by their families' names.
const TEXT_FACES = Object.freeze([
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
]);
const MONOSPACED_FACES = Object.freeze([
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
]);
// The option that leaves the face to the theme. It has no font, so it is always installed.
const DEFAULT = Object.freeze({ value: 'default', label: 'Default' });

// MARK: - Initializer
// MARK: - Public
// The faces ({ font }) installed here. A face that is not installed falls back and measures like the fallback, so a
// width unlike both generic fallbacks means it is there. A face with no font is the system's and always is.
function installedFonts(faces) {
    const context = document.createElement('canvas').getContext('2d');
    const width = (font) => {
        context.font = `20px ${font}`;
        return context.measureText(PROBE).width;
    };
    const monospace = width('monospace');
    const serif = width('serif');
    return faces.filter(
        (face) => !face.font || width(`${face.font}, monospace`) !== monospace || width(`${face.font}, serif`) !== serif
    );
}

// The installed faces for text, as a choice's options ({ value, label, font }): `default` first, then each by its
// family's name.
function textFonts() {
    return installedFonts(optionsOf(TEXT_FACES));
}

// The same of the fixed-width faces.
function monospacedFonts() {
    return installedFonts(optionsOf(MONOSPACED_FACES));
}

// MARK: - Private
function optionsOf(names) {
    return [DEFAULT, ...names.map((name) => ({ value: name, label: name, font: `"${name}"` }))];
}

export { installedFonts, textFonts, monospacedFonts };
