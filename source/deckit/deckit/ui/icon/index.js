DeckitModule.define(
    'deckit/ui/icon',
    { uses: ['deckit/ui/icon/model/lucide'], provides: ['icon', 'sanitize'] },
    ({ LUCIDE }) => {
        // MARK: - Property
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
        function icon(name, size = 15, { fill = 'none', color = 'currentColor' } = {}) {
            if (!Object.hasOwn(LUCIDE, name)) throw new Error(`no icon named ${name}`);
            return (
                `<svg viewBox="0 0 24 24" aria-hidden="true" width="${size}" height="${size}" style="display:block"` +
                ` fill="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
                LUCIDE[name] +
                `</svg>`
            );
        }

        // Another plugin's icon, drawn in this page. The text is that plugin's, so it is rebuilt from shapes alone:
        // nothing that runs, loads or styles crosses. What is not an SVG draws nothing.
        function sanitize(text) {
            // The HTML parser places <svg> in the SVG namespace without an xmlns, as icons are written. Its document is
            // inert: nothing in it loads or runs.
            const parsed = new DOMParser().parseFromString(String(text || ''), 'text/html').body.firstElementChild;
            if (parsed?.namespaceURI !== SVG || parsed.localName !== 'svg') return document.createElementNS(SVG, 'svg');
            const svg = copyOf(parsed);
            svg.setAttribute('aria-hidden', 'true');
            return svg;
        }

        // MARK: - Private
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

        return { icon, sanitize };
    }
);
