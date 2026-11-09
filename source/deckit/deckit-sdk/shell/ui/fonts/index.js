// MARK: - Property
// Letters whose widths differ from face to face.
const PROBE = 'mmmmmmmmmmlli1|WW@#';
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

// The faces for text, from `installed` (`{ families, monospaced }`), as a choice's options ({ value, label, font }):
// `default` first, then every family installed, by its name.
function textFonts(installed) {
    return optionsOf(installed.families);
}

// The same of the families whose faces are fixed-width.
function monospacedFonts(installed) {
    return optionsOf(installed.monospaced);
}

// A family by its name, as CSS names it in `font-family`.
function familyOf(name) {
    return `"${name.replace(/[\\"]/g, '\\$&')}"`;
}

// MARK: - Private
function optionsOf(names) {
    return [DEFAULT, ...names.map((name) => ({ value: name, label: name, font: familyOf(name) }))];
}

export { installedFonts, textFonts, monospacedFonts, familyOf };
