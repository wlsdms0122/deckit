import { LUCIDE } from './model/lucide.js';

// MARK: - Property
// The kit's icon frame, in px: as big as an icon of another mod's is drawn.
const FRAME = 24;
const SVG = 'http://www.w3.org/2000/svg';
const ELEMENTS = new Set([
    'svg',
    'g',
    'path',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'mask',
]);
const ATTRIBUTES = new Set([
    'viewBox',
    'width',
    'height',
    'preserveAspectRatio',
    'd',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'points',
    'transform',
    'id',
    'fill',
    'fill-rule',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-opacity',
    'opacity',
    'clip-rule',
    'clip-path',
    'mask',
    'offset',
    'stop-color',
    'stop-opacity',
    'gradientUnits',
    'gradientTransform',
]);

// MARK: - Initializer
// MARK: - Public
// One of the kit's icons, by name, as SVG markup.
function icon(name, options = {}) {
    if (!Object.hasOwn(LUCIDE, name)) throw new Error(`no icon named ${name}`);
    return iconOf(LUCIDE[name], options);
}

// An icon drawn from shapes in the kit's frame: a 24 by 24 box, stroked.
function iconOf(shapes, { size = 15, fill = 'none', color = 'currentColor', stroke = 2 } = {}) {
    return (
        `<svg viewBox="0 0 24 24" aria-hidden="true" width="${size}" height="${size}" style="display:block"` +
        ` fill="${fill}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
        shapes +
        `</svg>`
    );
}

// Another mod's icon, drawn in this page. The text is that mod's, so it is rebuilt from shapes alone:
// nothing that runs, loads or styles crosses, and it is no bigger than the kit's frame, so it cannot size itself
// in a page that is not its own. What is not an SVG draws nothing.
function sanitize(text) {
    // The HTML parser places <svg> in the SVG namespace without an xmlns, as icons are written. Its document is
    // inert: nothing in it loads or runs.
    const parsed = new DOMParser().parseFromString(String(text || ''), 'text/html').body.firstElementChild;
    if (parsed?.namespaceURI !== SVG || parsed.localName !== 'svg') return document.createElementNS(SVG, 'svg');
    const svg = copyOf(parsed);
    svg.setAttribute('aria-hidden', 'true');
    fit(svg);
    return svg;
}

// MARK: - Private
// Its width and height at most the frame's, its shape kept: a viewBox from what it said, if it said none.
function fit(svg) {
    const width = Number(svg.getAttribute('width'));
    const height = Number(svg.getAttribute('height'));
    if (!(width > 0) || !(height > 0) || (width <= FRAME && height <= FRAME)) return;
    if (!svg.hasAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const scale = FRAME / Math.max(width, height);
    svg.setAttribute('width', String(Math.round(width * scale)));
    svg.setAttribute('height', String(Math.round(height * scale)));
}

function copyOf(source) {
    const copy = document.createElementNS(SVG, source.localName);
    for (const { name, value } of source.attributes) {
        if (ATTRIBUTES.has(name) && isPlain(value)) copy.setAttribute(name, value);
    }
    for (const child of source.children) {
        if (child.namespaceURI === SVG && ELEMENTS.has(child.localName)) copy.append(copyOf(child));
    }
    return copy;
}

// A reference stays inside the icon: url(#id) only.
function isPlain(value) {
    return !/url\(\s*(?!['"]?#)/i.test(value);
}

export { icon, iconOf, sanitize };
