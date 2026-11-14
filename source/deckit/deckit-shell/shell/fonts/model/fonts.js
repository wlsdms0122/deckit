// MARK: - Property
// The person's fonts: the face text is written in and a size in px, each left out for the default.
const KEYS = Object.freeze(['text', 'size']);
// A face by the name of its family, as an installed font names it: any text on one line.
const FACE = /^[^\p{Cc}]{1,256}$/u;
const SIZE = Object.freeze({ min: 11, max: 22 });

// MARK: - Initializer
// MARK: - Public
// Why `fonts` are not fonts, or '': any of `text`, a face's name, and `size`, a whole size within SIZE, each left out
// for the default.
function problemOf(fonts) {
    if (!fonts || typeof fonts !== 'object' || Array.isArray(fonts)) return 'takes { text, size }';
    for (const [key, value] of Object.entries(fonts)) {
        if (!KEYS.includes(key)) return `takes no ${key}`;
        if (key === 'size' && !(Number.isInteger(value) && value >= SIZE.min && value <= SIZE.max))
            return `takes a whole size from ${SIZE.min} to ${SIZE.max}`;
        if (key === 'text' && !(typeof value === 'string' && FACE.test(value)))
            return 'takes the name of a face for text';
    }
    return '';
}

// The fonts as they were kept: a member that is not one is left out, the default.
function keptOf(value) {
    const kept = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(KEYS.filter((key) => !problemOf({ [key]: kept[key] })).map((key) => [key, kept[key]]));
}

// MARK: - Private

export { SIZE, problemOf, keptOf };
