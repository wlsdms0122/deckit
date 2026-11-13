// The token (deckit-sdk/shell/ui/token) in each look the host app gives: on the glass tint laid over white and over
// black, the glass inks are a ladder, `text`, `muted`, `tertiary`, `disabled`, each at least 1.5 times the contrast
// of the one below it over the worst ground, `muted` keeping 4.5:1, `tertiary` 3:1, `disabled` a step below
// `tertiary` and above the tint itself; the hued inks keep 4.5:1; none is quieter than its plain ink but `disabled`.
// The custom properties have a part marked `data-deckit-glass` draw in them, a part marked `data-deckit-solid` in the
// plain ones, and the plain ones are the glass inks while the system asks for less transparency or more contrast.
// Each role's motion is its spring sampled: the curve only rises, never past 1, arrives at 1 and is within `rest` of it
// at its length; the same spring gives the same curve; the custom properties hold the same lengths and curves, the
// movement lengths 0 while the system asks for reduced motion, the fades kept; what leaves is quicker than what comes.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
// The host app's two looks (deckit-app/theme/theme.js).
const LOOKS = {
    light: { contentBg: '#ffffff', contentColor: '#1d1c1d', border: '1px solid rgba(29,28,29,.13)', font: 'x' },
    dark: { contentBg: '#1a1d21', contentColor: '#d1d2d3', border: '1px solid rgba(121,124,129,.3)', font: 'x' },
};
const LADDER = ['text', 'muted', 'tertiary', 'disabled'];
const FLOORS = { muted: 4.5, tertiary: 3 };
const HUED = ['accent', 'okInk', 'warnInk', 'alertInk'];
const STEP = 1.5;
const glassOf = (ink) => `glass${ink[0].toUpperCase()}${ink.slice(1)}`;
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());

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
        const worst = (ink) => Math.min(...tints.map((tint) => COLOR.contrast(ink, tint)));
        const seen = Object.fromEntries(LADDER.map((ink) => [ink, worst(color[glassOf(ink)])]));
        for (const [above, below] of LADDER.slice(0, -1).map((ink, index) => [ink, LADDER[index + 1]])) {
            const ratio = seen[above] / seen[below];
            check(`${look}: glass ${above} is ${STEP} times glass ${below} or more`, ratio >= STEP, [seen, ratio]);
        }
        for (const [ink, floor] of Object.entries(FLOORS))
            check(`${look}: glass ${ink} keeps ${floor}:1 over the worst ground`, seen[ink] >= floor, seen[ink]);
        check(`${look}: glass disabled shows over the worst ground`, seen.disabled >= STEP, seen.disabled);
        for (const ink of HUED) {
            const least = worst(color[glassOf(ink)]);
            check(`${look}: glass ${ink} keeps 4.5:1 over the worst ground`, least >= 4.5, least);
        }
        for (const ink of [...LADDER.slice(0, -1), ...HUED]) {
            const [onGlass, onPlain] = [color[glassOf(ink)], color[ink]].map((each) => worst(each));
            check(`${look}: glass ${ink} is no quieter than ${ink}`, onGlass >= onPlain, [onGlass, onPlain]);
        }
        const properties = TOKEN.propertiesOf(token);
        const block = (selector) => new RegExp(`${selector} \\{([^}]*)\\}`).exec(properties)?.[1] || '';
        const inks = [...LADDER, ...HUED];
        const marked = block('\\[data-deckit-glass\\]');
        check(
            `${look}: a part marked as glass draws its text and glyphs in the glass inks`,
            inks.every((ink) => marked.includes(`--deckit-${kebab(ink)}: var(--deckit-glass-${kebab(ink)});`)) &&
                marked.includes('--deckit-placeholder: var(--deckit-glass-muted);'),
            marked
        );
        const solid = block('\\[data-deckit-solid\\]');
        check(
            `${look}: an opaque part on glass draws in the plain inks`,
            inks.every((ink) => solid.includes(`--deckit-${kebab(ink)}: ${color[ink]};`)) &&
                solid.includes(`--deckit-placeholder: ${color.placeholder};`),
            solid
        );
        const opaque = block('prefers-reduced-transparency: reduce\\) \\{ :root');
        check(
            `${look}: the glass inks are the plain ones while nothing is glass`,
            inks.every((ink) => opaque.includes(`--deckit-glass-${kebab(ink)}: ${color[ink]};`)),
            opaque
        );
    }

    const { MOTION, SPRING } = TOKEN;
    const pointsOf = (easing) => /^linear\((.*)\)$/.exec(easing)?.[1].split(', ').map(Number) || [];
    const properties = TOKEN.propertiesOf(TOKEN.tokenOf(LOOKS.dark));
    const root = /:root \{([^}]*)\}/.exec(properties)?.[1] || '';
    const still = /prefers-reduced-motion: reduce\) \{ :root \{([^}]*)\}/.exec(properties)?.[1] || '';
    for (const role of Object.keys(SPRING)) {
        const motion = MOTION[role];
        const points = pointsOf(motion.easing);
        check(`${role}: the curve has a point for each frame`, points.length > (motion.length / 1000) * 120, points);
        check(
            `${role}: the curve only rises`,
            points.every((at, index) => !index || at >= points[index - 1]),
            points
        );
        check(
            `${role}: the curve starts at 0 and ends at 1, never past it`,
            points[0] === 0 && points.at(-1) === 1 && points.every((at) => at <= 1),
            points
        );
        const left = 1 - TOKEN.springAt(SPRING[role], motion.length / 1000);
        check(`${role}: the spring is within its rest at its length`, left <= SPRING[role].rest * 1.01, left);
        const again = MOTION.over(role, 0.5 / SPRING[role].rest);
        check(
            `${role}: the same spring draws the same curve`,
            again.easing === motion.easing && again.length === motion.length,
            again
        );
        check(
            `${role}: the custom properties hold its length and curve`,
            root.includes(`--deckit-${role}: ${motion.length}ms;`) &&
                root.includes(`--deckit-${role}-fade: ${motion.fade}ms;`) &&
                root.includes(`--deckit-${role}-curve: ${motion.easing};`),
            root
        );
        check(
            `${role}: it does not move with reduced motion, and keeps its fade`,
            still.includes(`--deckit-${role}: 0ms;`) && !still.includes(`--deckit-${role}-fade`),
            still
        );
    }
    check('what leaves is quicker than what comes', MOTION.exit.length < MOTION.enter.length * 0.75, [
        MOTION.exit.length,
        MOTION.enter.length,
    ]);
    const near = MOTION.over('move', 8).length;
    const far = MOTION.over('move', 800).length;
    check('a farther travel takes longer', near < far, [near, far]);
    globalThis.window = { matchMedia: (query) => ({ matches: /reduced-motion/.test(query) }) };
    check(
        'with reduced motion nothing moves and fades keep their length',
        Object.keys(SPRING).every((role) => MOTION[role].length === 0 && MOTION[role].fade > 0),
        Object.keys(SPRING).map((role) => [MOTION[role].length, MOTION[role].fade])
    );

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
