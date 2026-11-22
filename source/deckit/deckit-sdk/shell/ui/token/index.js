import * as COLOR from '../color/index.js';
import * as FONTS from '../fonts/index.js';

// MARK: - Property
// Worn until the embedder gives its theme.
const FALLBACK_THEME = Object.freeze({
    border: '1px solid rgba(121,124,129,.3)',
    contentBg: '#1a1d21',
    contentColor: '#d1d2d3',
    font: '-apple-system, system-ui, sans-serif',
});
// The springs every motion is drawn from, one for each role, each with damping 1, so it comes to rest without going
// past where it is going. `response` is its period in s, how soon it answers; `rest` is how much of its way is left
// when it counts as arrived, where its length ends.
const SPRING = Object.freeze({
    // What comes on screen: answers at once and eases a long way in, so it lands softly.
    enter: Object.freeze({ response: 0.2, rest: 0.002 }),
    // What leaves: quicker and done sooner, as what goes is not watched to its end.
    exit: Object.freeze({ response: 0.16, rest: 0.01 }),
    // What is on screen and moves to another place there, landing on its pixel: a sidebar, a knob, a thumb.
    move: Object.freeze({ response: 0.19, rest: 0.001 }),
    // What follows a press or the pointer: a tint, a colour, a hover.
    press: Object.freeze({ response: 0.12, rest: 0.01 }),
});
// A curve as CSS has a point for each frame at this many a second.
const FRAMES = 120;
// What a travel of known px settles to, within these: half a px of it.
const REST = Object.freeze({ least: 0.0005, most: 0.05 });
// Each role's motion, read at each use: `length` in ms, for what moves or changes size, is 0 while the system asks for
// reduced motion; `fade` in ms, for what fades or changes colour, keeps its length then, so a state never jumps;
// `easing` is the spring as a CSS easing. `over(role, px)` is the role's spring settled to half a px of that travel.
const MOTION = Object.freeze({
    ...Object.fromEntries(Object.entries(SPRING).map(([role, spring]) => [role, motionOf(spring)])),
    over: (role, px) => motionOf({ ...SPRING[role], rest: Math.min(REST.most, Math.max(REST.least, 0.5 / px)) }),
    // Where a surface that slides in arrives from and leaves to.
    entrance: 'translateY(6px) scale(.99)',
});
// What differs between a light look and a dark one. `glass` is the strength a surface drawn as glass lays its colour
// at over what is behind it, blurred through. `rim` is the hairline inside a floating surface's edge, and `float` the
// shadow it casts. `sidebar` is the sidebar's material over the window's. `scrim` dims the page under a dialog. The
// shadow `icon` is a filter, laid under an app icon drawn at 32px and up, following the tile's shape. A window's
// shadows, `key` for the one with the keyboard and `inactive` for the rest, hold its ring: a wide ambient shadow and a
// tight contact one in light, and in dark, where a drop shadow reads as glow, a light rim besides, the key window's
// outside its edge, where the content does not cover it, and a deeper shadow.
const LOOKS = Object.freeze({
    light: {
        accent: '#2a6fdb',
        okInk: '#1a7f55',
        warnInk: '#8a6100',
        alertInk: '#c4174d',
        sidebar: 'rgba(0,0,0,.022)',
        rim: 'rgba(0,0,0,.08)',
        scrim: 'rgba(0,0,0,.3)',
        glass: 0.72,
        shadow: {
            float: '0 8px 24px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.1)',
            control: '0 1px 2px rgba(0,0,0,.3)',
            sidebar: 'inset 0 1px 0 rgba(255,255,255,.8), 0 1px 2px rgba(0,0,0,.08)',
            icon: 'drop-shadow(0 2px 3px rgba(0,0,0,.20))',
            key: '0 0 0 1px rgba(0,0,0,.10), 0 12px 36px rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.10)',
            inactive: '0 0 0 1px rgba(0,0,0,.08), 0 4px 14px rgba(0,0,0,.10)',
        },
    },
    dark: {
        accent: '#4b8bf4',
        okInk: '#2eb67d',
        warnInk: '#ecb22e',
        alertInk: '#ff5c86',
        sidebar: 'rgba(255,255,255,.035)',
        rim: 'rgba(255,255,255,.1)',
        scrim: 'rgba(0,0,0,.45)',
        glass: 0.85,
        shadow: {
            float: '0 8px 24px rgba(0,0,0,.4)',
            control: '0 1px 2px rgba(0,0,0,.5)',
            sidebar: 'inset 0 1px 0 rgba(255,255,255,.09), 0 1px 2px rgba(0,0,0,.35)',
            icon: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))',
            key:
                '0 0 0 1px rgba(255,255,255,.2), 0 0 0 2px rgba(0,0,0,.6), 0 16px 48px rgba(0,0,0,.65), ' +
                '0 2px 6px rgba(0,0,0,.4)',
            inactive: '0 0 0 1px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.06), 0 4px 14px rgba(0,0,0,.35)',
        },
    },
});
// The material a floating part in a page lays over what is behind it: none while the system asks for less
// transparency or more contrast.
const BLUR = 'blur(24px) saturate(1.6)';
// What the system asks for where nothing is drawn as glass.
const OPAQUE = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)';
// The rim's strength while the system asks for more contrast.
const RIM_MORE = 0.3;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
// The size text a person reads and writes is in, in px, until they choose one.
const TEXT_SIZE = 14;
// Code drawn in a page: what each kind of token is written in, on a dark ground and on a light one.
const SYNTAX = Object.freeze({
    dark: {
        keyword: '#c678dd',
        string: '#98c379',
        number: '#d19a66',
        comment: '#7f848e',
        function: '#61afef',
        type: '#e5c07b',
        property: '#e06c75',
        operator: '#56b6c2',
        meta: '#abb2bf',
        invalid: '#ff6b6b',
    },
    light: {
        keyword: '#cf222e',
        string: '#0a3069',
        number: '#0550ae',
        comment: '#6e7781',
        function: '#8250df',
        type: '#953800',
        property: '#116329',
        operator: '#0550ae',
        meta: '#57606a',
        invalid: '#cf222e',
    },
});
// The colours seats are told apart by, by name, in the order they are taken: each an ink that keeps the text minimum
// on the look's background, so what is written in the background's colour over it reads too.
const SEAT = Object.freeze({
    blue: { light: '#2a6fdb', dark: '#4b8bf4' },
    green: { light: '#1a7f55', dark: '#2eb67d' },
    orange: { light: '#b45309', dark: '#e8912d' },
    purple: { light: '#8250df', dark: '#b392f0' },
    pink: { light: '#bf3989', dark: '#f778ba' },
    teal: { light: '#0e7c86', dark: '#39c5cf' },
});
const SEAT_COLOURS = Object.freeze(Object.keys(SEAT));
// The type scale: each step's size in px and its line height, the title's tracking; `label` is what names a group
// or a column, drawn in `muted` in sentence case.
const TYPE = Object.freeze({
    caption: { size: 11, line: 1.35 },
    small: { size: 12, line: 1.4 },
    body: { size: 13, line: 1.45 },
    large: { size: 15, line: 1.4 },
    heading: { size: 17, line: 1.3 },
    title: { size: 20, line: 1.2, tracking: '-0.01em' },
    label: { size: 12, line: 1.4, weight: 600 },
});
// The sizes in px an app icon is drawn at, one per role: in a menu, a bar or a sidebar heading; in a row; leading the
// top match or a mod's own head; in the Dock; in a launcher's grid.
const APP_ICON = Object.freeze({ small: 16, row: 20, lead: 32, dock: 40, grid: 56 });
// A floating surface over the desktop (the Dock, the status bar's capsule): how far in px it stands from the edge of the
// camera nearest it.
const FLOAT = Object.freeze({ margin: 8 });
// A neutral grey over any background, light or dark.
const WASH = (amount) => `rgba(128,128,128,${amount})`;
// The quieter inks: how much of `text` over `background` each is, and the least contrast it keeps on glass.
// `disabled` has no floor: an inactive control is exempt from the text minimum.
const INK = Object.freeze({
    muted: { amount: 0.68, glass: 4.5 },
    tertiary: { amount: 0.55, glass: 3 },
    disabled: { amount: 0.3, glass: null },
});
// The inks in a hue, read as text and glyphs: on glass each keeps the text minimum, as `muted` does.
const HUED = Object.freeze(['accent', 'okInk', 'warnInk', 'alertInk']);
// On glass the inks are a ladder, `text`, `muted`, `tertiary`, `disabled`: each keeps at least this many times the
// contrast of the one below it on the tint over the worst ground. It is the ratio of the text minimum to the glyph
// one (4.5 to 3), so the steps read as evenly as those two do, and `disabled`, a step below 3:1, still shows.
const STEP = 1.5;
// The plainest grounds glass lies over. The material only moves what is behind towards its own blur, so an ink that
// holds on the tint laid over both holds over anything.
const GROUNDS = Object.freeze(['#ffffff', '#000000']);

// MARK: - Initializer
// MARK: - Public
// What every view draws with, derived once from the embedder's theme and the person's fonts. `font` and `type` are the
// host's, the face the app's own parts are in; `textFont` and `textSize` are what a page's text is in where nothing
// chooses another, and text a person reads and writes, the person's where they chose them; `fonts` is what the person
// chose, `{ text, size }`, each left out for the default; `mono` is the system's fixed-width face. `glass` and `blur`
// are read at each use: 1 and none, opaque, while the system asks for less transparency or more contrast.
function tokenOf(theme, fonts = {}) {
    const text = theme.contentColor;
    const background = theme.contentBg;
    const toward = (amount) => COLOR.mix(text, background, amount);
    const dark = COLOR.isDark(background);
    const look = LOOKS[dark ? 'dark' : 'light'];
    const elevated = toward(dark ? 0.1 : 0);
    const glass = glassInks({ text, background, elevated, look, dark });
    return deepFreeze({
        dark,
        font: theme.font,
        mono: MONO,
        textFont: fonts.text ? `${FONTS.familyOf(fonts.text)}, ${theme.font}` : theme.font,
        textSize: fonts.size || TEXT_SIZE,
        fonts: { ...(fonts.text ? { text: fonts.text } : {}), ...(fonts.size ? { size: fonts.size } : {}) },
        type: mapped(TYPE, (step) => fontOf(step, theme.font)),
        tracking: { title: TYPE.title.tracking },
        border: theme.border,
        color: {
            text,
            // Secondary text, 4.5:1 or more on `background`, `lifted` and `elevated` in both looks.
            muted: toward(INK.muted.amount),
            // A step quieter than `muted`, for a mark that only supports a row: 3:1 or more on `background` and
            // `lifted` in both looks.
            tertiary: toward(INK.tertiary.amount),
            disabled: toward(INK.disabled.amount),
            placeholder: toward(INK.muted.amount),
            // What is drawn as glass, marked `data-deckit-glass`, draws its text and glyphs in these (glassInks).
            ...glass,
            background,
            surface: toward(0.06),
            lifted: toward(0.1),
            // What floats over the content: a menu, a popover, a dialog's card, a toast, the Dock.
            elevated,
            // The thumb of a control on a filled track, the chosen part lifted off it: lighter than the track in both
            // looks, so it clears the track's `fill` where `elevated` does not.
            thumb: toward(dark ? 0.24 : 0),
            sidebar: look.sidebar,
            divider: WASH(0.22),
            fill: WASH(0.12),
            hover: WASH(0.14),
            selected: WASH(0.22),
            // The chosen rows of the list that has the keyboard: the accent's tint, so the keys' place shows.
            selectedFocused: COLOR.alpha(look.accent, dark ? 0.32 : 0.22),
            pressed: WASH(0.3),
            // Text and glyphs in the accent, and the fill of what is on or pressed first, white over it.
            accent: look.accent,
            accentFill: '#2a6fdb',
            onAccent: '#fff',
            // Status as a fill (a dot, a wash) and as text or a glyph.
            ok: '#2eb67d',
            warn: '#ecb22e',
            alert: '#e01e5a',
            okInk: look.okInk,
            warnInk: look.warnInk,
            alertInk: look.alertInk,
            focus: look.accent,
            // What a drop or a context menu is about.
            target: look.accent,
            scrim: look.scrim,
            folder: '#5aa9e6',
        },
        radius: { small: 4, control: 6, medium: 8, large: 10, card: 12, round: 999 },
        appIcon: { ...APP_ICON },
        float: { ...FLOAT },
        rim: rimOf(look.rim),
        shadow: {
            lifted: '0 8px 22px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.2)',
            // Along an edge of the content and over it, casting to every side whichever edge it is at.
            drawer: '0 0 24px rgba(0,0,0,.22)',
            ...look.shadow,
        },
        syntax: { ...SYNTAX[dark ? 'dark' : 'light'] },
        seat: mapped(SEAT, (colour) => colour[dark ? 'dark' : 'light']),
        motion: MOTION,
        get glass() {
            return opaque() ? 1 : look.glass;
        },
        get blur() {
            return opaque() ? 'none' : BLUR;
        },
    });
}

// The token as custom properties on the root (`--deckit-muted`, `--deckit-radius-card`, ...), so a stylesheet
// reads it by name, and what changes with the system's settings in media queries after it.
function propertiesOf(token) {
    const look = LOOKS[token.dark ? 'dark' : 'light'];
    const properties = {
        font: token.font,
        mono: token.mono,
        textFont: token.textFont,
        textSize: token.textSize + 'px',
        border: token.border,
        ...prefixed('', token.color),
        ...prefixed('type-', token.type),
        ...prefixed('tracking-', token.tracking),
        ...prefixed(
            'radius-',
            mapped(token.radius, (value) => value + 'px')
        ),
        rim: token.rim,
        ...prefixed('shadow-', token.shadow),
        ...prefixed('seat-', token.seat),
        ...prefixed(
            'app-icon-',
            mapped(token.appIcon, (value) => value + 'px')
        ),
        ...prefixed(
            'float-',
            mapped(token.float, (value) => value + 'px')
        ),
        glass: look.glass * 100 + '%',
        blur: BLUR,
        ...Object.fromEntries(
            Object.keys(SPRING).flatMap((role) => [
                [role, lengthOf(SPRING[role]) + 'ms'],
                [role + 'Fade', lengthOf(SPRING[role]) + 'ms'],
                [role + 'Curve', MOTION[role].easing],
            ])
        ),
    };
    const declarations = Object.entries(properties).map(([name, value]) => `--deckit-${kebab(name)}: ${value};`);
    const still = Object.keys(SPRING).map((role) => `--deckit-${role}: 0ms;`);
    // What is marked as glass takes the glass inks, a placeholder `muted`'s; where nothing is drawn as glass they are
    // the plain ones. An opaque part in it, marked `data-deckit-solid` (a card, a field with a fill of its own), is
    // not glass and takes the plain ones again.
    const inks = ['text', ...Object.keys(INK), ...HUED];
    const glassOf = (ink) => `--deckit-glass-${kebab(ink)}`;
    const glass = [
        ...inks.map((ink) => `--deckit-${kebab(ink)}: var(${glassOf(ink)});`),
        `--deckit-placeholder: var(${glassOf('muted')});`,
    ];
    const plain = [
        ...inks.map((ink) => `--deckit-${kebab(ink)}: ${token.color[ink]};`),
        `--deckit-placeholder: ${token.color.placeholder};`,
    ];
    const solid = inks.map((ink) => `${glassOf(ink)}: ${token.color[ink]};`);
    const opaque = `--deckit-glass: 100%; --deckit-blur: none; ${solid.join(' ')}`;
    const more = `${opaque} --deckit-rim: ${rimOf(COLOR.alpha(look.rim, RIM_MORE))};`;
    return (
        `:root { ${declarations.join(' ')} }\n` +
        `[data-deckit-glass] { ${glass.join(' ')} }\n` +
        `[data-deckit-solid] { ${plain.join(' ')} }\n` +
        `@media (prefers-reduced-motion: reduce) { :root { ${still.join(' ')} } }\n` +
        `@media (prefers-reduced-transparency: reduce) { :root { ${opaque} } }\n` +
        `@media (prefers-contrast: more) { :root { ${more} } }\n`
    );
}

// MARK: - Private
// The inks on glass, one rule for all: each is the quietest point on its scale that keeps its floor on the glass tint
// (`elevated` at the look's strength) over the worst ground, and STEP over the ink below it. The scale of `muted`,
// `tertiary` and `text` runs from `background` through `text` on to the pole `text` leans to, so `text` moves
// towards the pole where `muted` needs the room. `disabled` is the loudest a step below `tertiary`. A hued ink runs
// from itself to the pole and keeps the text minimum.
function glassInks({ text, background, elevated, look, dark }) {
    const pole = dark ? '#ffffff' : '#000000';
    const tints = GROUNDS.map((ground) => COLOR.mix(elevated, ground, look.glass));
    const worst = (ink) => Math.min(...tints.map((tint) => COLOR.contrast(ink, tint)));
    const scale = (at) => (at <= 1 ? COLOR.mix(text, background, at) : COLOR.mix(pole, text, at - 1));
    const by = (at, delta) => Math.round(at * 100 + delta) / 100;
    const lift = (path, at, least, end) => {
        while (at < end && worst(path(at)) < least) at = by(at, 1);
        return at;
    };
    const tertiary = lift(scale, INK.tertiary.amount, INK.tertiary.glass, 2);
    const muted = lift(scale, INK.muted.amount, Math.max(INK.muted.glass, worst(scale(tertiary)) * STEP), 2);
    const lead = lift(scale, 1, worst(scale(muted)) * STEP, 2);
    let disabled = tertiary;
    while (disabled > 0 && worst(scale(disabled)) * STEP > worst(scale(tertiary))) disabled = by(disabled, -1);
    const hued = HUED.map((name) => {
        const path = (at) => COLOR.mix(pole, look[name], at);
        return [`glass${name[0].toUpperCase()}${name.slice(1)}`, path(lift(path, 0, INK.muted.glass, 1))];
    });
    return {
        glassText: scale(lead),
        glassMuted: scale(muted),
        glassTertiary: scale(tertiary),
        glassDisabled: scale(disabled),
        ...Object.fromEntries(hued),
    };
}

function prefixed(prefix, values) {
    return Object.fromEntries(Object.entries(values).map(([name, value]) => [prefix + name, value]));
}

function mapped(values, convert) {
    return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, convert(value)]));
}

function kebab(name) {
    return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

// A type step as a font shorthand: its weight where it has one, its size and line height, the face.
function fontOf({ size, line, weight }, font) {
    return `${weight ? weight + ' ' : ''}${size}px/${line} ${font}`;
}

function rimOf(colour) {
    return `inset 0 0 0 1px ${colour}`;
}

// A role's motion as `MOTION` has it.
function motionOf(spring) {
    const length = lengthOf(spring);
    const easing = easingOf(spring);
    return Object.freeze({
        ...spring,
        get length() {
            return reducedMotion() ? 0 : length;
        },
        fade: length,
        easing,
    });
}

// Where a spring with damping 1, started from rest, is `t` s after it starts, from 0 to 1, never past it.
function springAt({ response }, t) {
    const w = (2 * Math.PI) / response;
    return 1 - (1 + w * t) * Math.exp(-w * t);
}

// How long in ms the spring takes until what is left of its way is `rest`: (1 + u) e^-u = rest, u = w t, found by
// halving, as what is left only falls.
function lengthOf({ response, rest }) {
    let [low, high] = [0, 64];
    while (high - low > 1e-6) {
        const u = (low + high) / 2;
        if ((1 + u) * Math.exp(-u) > rest) low = u;
        else high = u;
    }
    return Math.round(((high * response) / (2 * Math.PI)) * 1000);
}

// The spring over its length as a CSS `linear()` easing: a point for each frame, to a thousandth, arriving at 1.
function easingOf(spring) {
    const length = lengthOf(spring) / 1000;
    const steps = Math.max(2, Math.ceil(length * FRAMES));
    const points = Array.from({ length: steps }, (_, step) => springAt(spring, (length * step) / steps).toFixed(3));
    return `linear(${points.map(Number).join(', ')}, 1)`;
}

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Whether the system asks for less transparency or more contrast, so nothing is drawn as glass.
function opaque() {
    return window.matchMedia(OPAQUE).matches;
}

// `listener()` hears the system start or stop asking for less transparency or more contrast.
function whenOpaque(listener) {
    window.matchMedia(OPAQUE).addEventListener('change', () => listener());
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
}

export {
    FALLBACK_THEME,
    SPRING,
    MOTION,
    APP_ICON,
    FLOAT,
    SEAT_COLOURS,
    tokenOf,
    propertiesOf,
    springAt,
    lengthOf,
    opaque,
    whenOpaque,
};
