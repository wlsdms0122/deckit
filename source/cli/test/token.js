// The token (deckit-sdk/shell/ui/token) in each look the host app gives: the glass inks keep 4.5:1 (`glassMuted`) and
// 3:1 (`glassTertiary`, `glassDisabled`) on the glass tint laid over white and over black, are no quieter than the
// plain inks, and the custom properties have a part marked `data-deckit-glass` draw in them, the plain ones while the
// system asks for less transparency or more contrast. Exits 1 with a line for each check that failed. The packages are
// ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
// The host app's two looks (deckit-app/theme/theme.js).
const LOOKS = {
    light: { contentBg: '#ffffff', contentColor: '#1d1c1d', border: '1px solid rgba(29,28,29,.13)', font: 'x' },
    dark: { contentBg: '#1a1d21', contentColor: '#d1d2d3', border: '1px solid rgba(121,124,129,.3)', font: 'x' },
};
const FLOORS = { glassMuted: ['muted', 4.5], glassTertiary: ['tertiary', 3], glassDisabled: ['disabled', 3] };

async function main() {
    // Glass as it is drawn: the system asks for nothing.
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    const TOKEN = await import(url('deckit-sdk', 'shell', 'ui', 'token', 'index.js'));
    const COLOR = await import(url('deckit-sdk', 'shell', 'ui', 'color', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    for (const [look, theme] of Object.entries(LOOKS)) {
        const token = TOKEN.tokenOf(theme);
        const { color } = token;
        const tints = ['#ffffff', '#000000'].map((ground) => COLOR.mix(color.elevated, ground, token.glass));
        for (const [ink, [plain, floor]] of Object.entries(FLOORS)) {
            const least = Math.min(...tints.map((tint) => COLOR.contrast(color[ink], tint)));
            check(`${look}: ${ink} keeps ${floor}:1 on the glass tint over white and black`, least >= floor, least);
            const [onInk, onPlain] = [color[ink], color[plain]].map((each) => COLOR.contrast(each, color.background));
            check(`${look}: ${ink} is no quieter than ${plain}`, onInk >= onPlain, [color[ink], color[plain]]);
        }
        const properties = TOKEN.propertiesOf(token);
        const marked = /\[data-deckit-glass\] \{([^}]*)\}/.exec(properties)?.[1] || '';
        check(
            `${look}: a part marked as glass draws its quieter text in the glass inks`,
            ['muted', 'placeholder'].every((ink) => marked.includes(`--deckit-${ink}: var(--deckit-glass-muted);`)) &&
                marked.includes('--deckit-tertiary: var(--deckit-glass-tertiary);') &&
                marked.includes('--deckit-disabled: var(--deckit-glass-disabled);'),
            marked
        );
        const opaque = /prefers-reduced-transparency: reduce\) \{ :root \{([^}]*)\}/.exec(properties)?.[1] || '';
        check(
            `${look}: the glass inks are the plain ones while nothing is glass`,
            opaque.includes(`--deckit-glass-muted: ${color.muted};`) &&
                opaque.includes(`--deckit-glass-disabled: ${color.disabled};`),
            opaque
        );
    }

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} token checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
