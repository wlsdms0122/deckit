// MARK: - Property
// The person's fonts: the face text is written in, the fixed-width face and a size in px, each null for the default.
const DEFAULT = Object.freeze({ text: null, mono: null, size: null });
// A face by the name of its family, as an installed font names it.
const FACE = /^[\p{L}\p{N} ._-]{1,64}$/u;
const SIZE = Object.freeze({ min: 11, max: 22 });

// MARK: - Initializer
// MARK: - Public
// Why `change` is not a change of the fonts, or '': any of `text` and `mono`, a face's name, and `size`, a whole size
// within SIZE, each null for the default.
function problemOf(change) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) return 'takes { text, mono, size }';
    for (const [key, value] of Object.entries(change)) {
        if (!Object.hasOwn(DEFAULT, key)) return `takes no ${key}`;
        if (value === null) continue;
        if (key === 'size' && !(Number.isInteger(value) && value >= SIZE.min && value <= SIZE.max))
            return `takes a whole size from ${SIZE.min} to ${SIZE.max}, or null`;
        if (key !== 'size' && !(typeof value === 'string' && FACE.test(value)))
            return `takes the name of a face for ${key}, or null`;
    }
    return '';
}

// `fonts` with `change` over it: what the change names takes its value, and the rest stay.
function merged(fonts, change) {
    return Object.fromEntries(
        Object.keys(DEFAULT).map((key) => [key, Object.hasOwn(change, key) ? change[key] : fonts[key]])
    );
}

// The fonts as they were kept: a member that is not one is the default.
function keptOf(value) {
    const kept = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(
        Object.keys(DEFAULT).map((key) => {
            const one = { [key]: kept[key] ?? null };
            return [key, problemOf(one) ? null : one[key]];
        })
    );
}

// MARK: - Private

export { DEFAULT, SIZE, problemOf, merged, keptOf };
