import * as COLOR from '../color/index.js';

// MARK: - Property
// Worn until the embedder gives its theme.
const FALLBACK_THEME = Object.freeze({
    border: '1px solid rgba(121,124,129,.3)',
    contentBg: '#1a1d21',
    contentColor: '#d1d2d3',
    font: '-apple-system, system-ui, sans-serif',
});
const LENGTH = Object.freeze({ fast: 110, base: 170, slow: 260 });
// Lengths in ms, read at each use: 0 while the system asks for reduced motion.
const MOTION = Object.freeze({
    get fast() {
        return reducedMotion() ? 0 : LENGTH.fast;
    },
    get base() {
        return reducedMotion() ? 0 : LENGTH.base;
    },
    get slow() {
        return reducedMotion() ? 0 : LENGTH.slow;
    },
    easing: 'cubic-bezier(.2,.7,.3,1)',
    // Where a panel or a modal arrives from and leaves to.
    entrance: 'translateY(6px) scale(.99)',
});
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
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
const TYPE = { caption: 11, small: 12, body: 13, medium: 14, large: 15, heading: 16, title: 18 };
// A neutral grey over any background, light or dark.
const WASH = (amount) => `rgba(128,128,128,${amount})`;

// MARK: - Initializer
// MARK: - Public
// What every view draws with, derived once from the embedder's theme.
function tokenOf(theme) {
    const text = theme.contentColor;
    const background = theme.contentBg;
    const toward = (amount) => COLOR.mix(text, background, amount);
    const dark = COLOR.isDark(background);
    return deepFreeze({
        dark,
        font: theme.font,
        mono: MONO,
        type: Object.fromEntries(Object.entries(TYPE).map(([name, size]) => [name, `${size}px ${theme.font}`])),
        border: theme.border,
        color: {
            text,
            muted: toward(0.62),
            disabled: toward(0.3),
            background,
            surface: toward(0.06),
            lifted: toward(0.1),
            divider: WASH(0.22),
            fill: WASH(0.12),
            hover: WASH(0.14),
            selected: WASH(0.22),
            pressed: WASH(0.3),
            accent: '#4b8bf4',
            onAccent: '#fff',
            ok: '#2eb67d',
            warn: '#ecb22e',
            alert: '#e01e5a',
            focus: 'rgba(124,160,255,.7)',
            // What a drop or a context menu is about.
            target: 'rgba(75,139,244,.75)',
            scrim: 'rgba(0,0,0,.45)',
            folder: '#5aa9e6',
        },
        radius: { small: 4, control: 6, medium: 8, large: 10, card: 12, round: 999 },
        shadow: {
            raised: '0 10px 32px rgba(0,0,0,.32)',
            nested: '0 14px 40px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.28)',
            modal: '0 18px 48px rgba(0,0,0,.4)',
            lifted: '0 8px 22px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.2)',
            // Along an edge of the content and over it, casting to every side whichever edge it is at.
            drawer: '0 0 24px rgba(0,0,0,.22)',
        },
        syntax: { ...SYNTAX[dark ? 'dark' : 'light'] },
        motion: MOTION,
    });
}

// The token as custom properties on the root (`--deckit-muted`, `--deckit-radius-card`, ...), so a stylesheet
// reads it by name.
function propertiesOf(token) {
    const properties = {
        font: token.font,
        mono: token.mono,
        border: token.border,
        ...prefixed('', token.color),
        ...prefixed('type-', token.type),
        ...prefixed(
            'radius-',
            mapped(token.radius, (value) => value + 'px')
        ),
        ...prefixed('shadow-', token.shadow),
        ...mapped(LENGTH, (value) => value + 'ms'),
        easing: MOTION.easing,
    };
    const declarations = Object.entries(properties).map(([name, value]) => `--deckit-${kebab(name)}: ${value};`);
    return (
        `:root { ${declarations.join(' ')} }\n` +
        `@media (prefers-reduced-motion: reduce) { :root { --deckit-fast: 0ms; --deckit-base: 0ms; --deckit-slow: 0ms; } }\n`
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

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
}

export { FALLBACK_THEME, MOTION, tokenOf, propertiesOf };
