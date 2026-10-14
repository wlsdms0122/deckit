// MARK: - Property
const STYLE = '';
// Letters whose widths differ from face to face.
const PROBE = 'mmmmmmmmmmlli1|WW@#';

// MARK: - Initializer
// MARK: - Public
function make() {
    return { installedFonts };
}

// MARK: - Private
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

export { STYLE, make };
