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
// Lengths in ms, as long as each can take: read as they are where nothing knows the system's settings.
const LENGTH = Object.freeze({ fast: 110, base: 170, slow: 260 });
// Lengths in ms, read at each use. `move`, for what moves or changes size, is 0 while the system asks for reduced
// motion; `fade`, for what fades or changes colour, keeps its length then, so a state never jumps.
const MOTION = Object.freeze({
    move: Object.freeze({
        get fast() {
            return reducedMotion() ? 0 : LENGTH.fast;
        },
        get base() {
            return reducedMotion() ? 0 : LENGTH.base;
        },
        get slow() {
            return reducedMotion() ? 0 : LENGTH.slow;
        },
    }),
    fade: LENGTH.fast,
    // What comes on screen and leaves it.
    easing: 'cubic-bezier(.2,.7,.3,1)',
    // What is on screen and moves to another place there: a sidebar, the Dock, an indicator.
    easingMove: 'cubic-bezier(.65,0,.35,1)',
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
// A neutral grey over any background, light or dark.
const WASH = (amount) => `rgba(128,128,128,${amount})`;
// The quieter inks: how much of `text` over `background` each is, and the least contrast it keeps on glass.
const INK = Object.freeze({
    muted: { amount: 0.68, glass: 4.5 },
    tertiary: { amount: 0.55, glass: 3 },
    disabled: { amount: 0.3, glass: 3 },
});
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
    // An ink as it is drawn on glass: raised towards `text` until it keeps its contrast on the tint over each ground.
    const tints = GROUNDS.map((ground) => COLOR.mix(elevated, ground, look.glass));
    const onGlass = ({ amount, glass }) => {
        let at = amount;
        while (at < 1 && tints.some((tint) => COLOR.contrast(toward(at), tint) < glass))
            at = Math.round(at * 100 + 1) / 100;
        return toward(at);
    };
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
            // What is drawn as glass, marked `data-deckit-glass`, draws its quieter text and glyphs in these, raised
            // from `muted`, `tertiary` and `disabled` until they keep 4.5:1, 3:1 and 3:1 on its tint over any ground.
            glassMuted: onGlass(INK.muted),
            glassTertiary: onGlass(INK.tertiary),
            glassDisabled: onGlass(INK.disabled),
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
        rim: rimOf(look.rim),
        shadow: {
            lifted: '0 8px 22px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.2)',
            // Along an edge of the content and over it, casting to every side whichever edge it is at.
            drawer: '0 0 24px rgba(0,0,0,.22)',
            ...look.shadow,
        },
        syntax: { ...SYNTAX[dark ? 'dark' : 'light'] },
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
        ...prefixed(
            'app-icon-',
            mapped(token.appIcon, (value) => value + 'px')
        ),
        glass: look.glass * 100 + '%',
        blur: BLUR,
        fade: MOTION.fade + 'ms',
        ...prefixed(
            'move-',
            mapped(LENGTH, (value) => value + 'ms')
        ),
        easing: MOTION.easing,
        easingMove: MOTION.easingMove,
    };
    const declarations = Object.entries(properties).map(([name, value]) => `--deckit-${kebab(name)}: ${value};`);
    const still = Object.keys(LENGTH).map((name) => `--deckit-move-${name}: 0ms;`);
    // What is marked as glass takes the glass inks, a placeholder `muted`'s; where nothing is drawn as glass they are
    // the plain ones.
    const inks = Object.keys(INK);
    const glass = [
        ...inks.map((ink) => `--deckit-${ink}: var(--deckit-glass-${ink});`),
        '--deckit-placeholder: var(--deckit-glass-muted);',
    ];
    const solid = inks.map((ink) => `--deckit-glass-${ink}: ${token.color[ink]};`);
    const opaque = `--deckit-glass: 100%; --deckit-blur: none; ${solid.join(' ')}`;
    const more = `${opaque} --deckit-rim: ${rimOf(COLOR.alpha(look.rim, RIM_MORE))};`;
    return (
        `:root { ${declarations.join(' ')} }\n` +
        `[data-deckit-glass] { ${glass.join(' ')} }\n` +
        `@media (prefers-reduced-motion: reduce) { :root { ${still.join(' ')} } }\n` +
        `@media (prefers-reduced-transparency: reduce) { :root { ${opaque} } }\n` +
        `@media (prefers-contrast: more) { :root { ${more} } }\n`
    );
}

// MARK: - Private
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

export { FALLBACK_THEME, LENGTH, MOTION, APP_ICON, tokenOf, propertiesOf, opaque, whenOpaque };
