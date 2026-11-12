import * as COLOR from '../color/index.js';

// MARK: - Property
const STYLE = `
    .deckit-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        flex: 0 0 auto;
        box-sizing: border-box;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--deckit-text);
        font: var(--deckit-type-body);
        cursor: pointer;
        transition:
            background-color var(--deckit-fade) var(--deckit-easing),
            color var(--deckit-fade) var(--deckit-easing),
            opacity var(--deckit-fade) var(--deckit-easing),
            filter var(--deckit-fade) var(--deckit-easing);
    }
    .deckit-button:hover { background: var(--deckit-hover); }
    .deckit-button:active { background: var(--deckit-pressed); }
    .deckit-button:is(:disabled, [aria-disabled='true']) {
        background: transparent;
        color: var(--deckit-disabled);
        cursor: default;
    }
    .deckit-icon-button { width: 32px; height: 32px; border-radius: var(--deckit-radius-medium); }
    .deckit-icon-button[data-size='small'] { width: 24px; height: 24px; border-radius: var(--deckit-radius-control); }
    .deckit-icon-button[data-muted]:not(:hover) { color: var(--deckit-muted); }
    .deckit-icon-button[aria-pressed='true'] { color: var(--deckit-accent); }
    .deckit-text-button {
        height: 32px;
        padding: 0 12px;
        border: var(--deckit-border);
        border-radius: var(--deckit-radius-medium);
    }
    .deckit-text-button[data-size='small'] {
        height: 24px;
        padding: 0 9px;
        border-radius: var(--deckit-radius-control);
        font: var(--deckit-type-small);
    }
    .deckit-text-button[data-variant='primary'] { --deckit-fill-on: var(--deckit-accent-fill); }
    .deckit-text-button[data-variant='destructive'] { --deckit-fill-on: var(--deckit-alert); }
    .deckit-text-button[data-variant],
    .deckit-text-button[data-variant]:hover,
    .deckit-text-button[data-variant]:active {
        border: 0;
        background: var(--deckit-fill-on);
        color: var(--deckit-on-accent);
    }
    .deckit-text-button[data-variant]:hover { filter: brightness(1.1); }
    .deckit-text-button[data-variant]:active { filter: brightness(0.92); }
    .deckit-text-button[data-variant]:is(:disabled, [aria-disabled='true']) {
        background: var(--deckit-disabled);
        filter: none;
    }
    .deckit-row-action {
        width: 24px;
        height: 24px;
        border-radius: var(--deckit-radius-control);
        color: inherit;
        line-height: 1;
    }
    .deckit-segmented {
        display: flex;
        gap: 2px;
        flex: 0 0 auto;
        box-sizing: border-box;
        height: 32px;
        padding: 2px;
        border-radius: var(--deckit-radius-medium);
        background: var(--deckit-fill);
    }
    .deckit-segment {
        gap: 6px;
        height: 100%;
        padding: 0 10px;
        border-radius: var(--deckit-radius-control);
        color: var(--deckit-muted);
        font: 600 var(--deckit-type-body);
    }
    .deckit-segmented[data-fill] { width: 100%; }
    .deckit-segmented[data-fill] .deckit-segment { flex: 1 1 0; justify-content: center; }
    .deckit-segmented[data-size='small'] { height: 24px; border-radius: var(--deckit-radius-control); }
    .deckit-segmented[data-size='small'] .deckit-segment {
        padding: 0 8px;
        border-radius: var(--deckit-radius-small);
        font: 600 var(--deckit-type-small);
    }
    .deckit-segment[aria-pressed='true'] {
        background: var(--deckit-elevated);
        box-shadow: var(--deckit-shadow-control);
        color: var(--deckit-text);
    }
    .deckit-segmented[data-accent] .deckit-segment[aria-pressed='true'] {
        background: var(--deckit-segment-on);
        color: var(--deckit-segment-ink);
    }
    .deckit-toggle-button {
        min-width: 24px;
        height: 24px;
        padding: 0 4px;
        border-radius: var(--deckit-radius-small);
        color: var(--deckit-muted);
        font: 600 11px var(--deckit-mono);
    }
    .deckit-toggle-button[data-marked] { color: var(--deckit-accent); }
    .deckit-toggle-button[aria-pressed='true'],
    .deckit-toggle-button[aria-pressed='true']:hover {
        background: color-mix(in srgb, var(--deckit-accent) 16%, transparent);
        color: var(--deckit-accent);
    }
    .deckit-toggle {
        position: relative;
        width: 34px;
        height: 20px;
        border-radius: var(--deckit-radius-round);
    }
    .deckit-toggle { background: var(--deckit-pressed); }
    .deckit-toggle:hover { background: linear-gradient(var(--deckit-hover) 0 0), var(--deckit-pressed); }
    .deckit-toggle:active { background: linear-gradient(var(--deckit-pressed) 0 0), var(--deckit-pressed); }
    .deckit-toggle[aria-checked='true'] { background: var(--deckit-accent-fill); }
    .deckit-toggle[aria-checked='true']:hover { filter: brightness(1.1); }
    .deckit-toggle[aria-checked='true']:active { filter: brightness(0.92); }
    .deckit-toggle[aria-disabled='true'] { background: var(--deckit-fill); filter: none; }
    .deckit-toggle[aria-disabled='true'][aria-checked='true'] {
        background: color-mix(in srgb, var(--deckit-accent-fill) 45%, transparent);
    }
    .deckit-toggle-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-on-accent);
        box-shadow: var(--deckit-shadow-control);
        transition: transform var(--deckit-move-fast) var(--deckit-easing-move);
    }
    .deckit-toggle[aria-checked='true'] .deckit-toggle-knob { transform: translateX(14px); }
`;

// MARK: - Initializer
// MARK: - Public
function make() {
    return { iconButton, button, rowAction, segmented, toggleButton, toggle, tooltip };
}

// MARK: - Private
// A button showing an icon. `muted` rests it a step back until the pointer comes.
function iconButton({ icon, title, size = 'medium', muted = false, onClick }) {
    const element = buttonOf('deckit-icon-button', title, size);
    element.innerHTML = icon;
    element.toggleAttribute('data-muted', muted);
    element.addEventListener('click', unlessDisabled(element, onClick));
    return {
        element,
        setPressed: (on) => element.setAttribute('aria-pressed', String(!!on)),
        setEnabled: (on) => setEnabled(element, on),
        setIcon: (next) => (element.innerHTML = next),
    };
}

function button({ label, title = '', icon = '', size = 'medium', variant = 'plain', onClick }) {
    const element = buttonOf('deckit-text-button', title, size);
    const text = document.createElement('span');
    text.textContent = label;
    if (icon) element.insertAdjacentHTML('afterbegin', icon);
    element.append(text);
    if (variant !== 'plain') element.dataset.variant = variant;
    element.addEventListener('click', unlessDisabled(element, onClick));
    return {
        element,
        setLabel: (next) => (text.textContent = next),
        setEnabled: (on) => setEnabled(element, on),
    };
}

// An action of a row, shown while the row is hovered or holds the focus, and always where no row or element marked
// `data-deckit-row-actions` holds it. Its click is its own, not the row's.
function rowAction({ icon = '', label = '', title, onClick }) {
    const element = buttonOf('deckit-row-action', title, 'medium');
    if (icon) element.innerHTML = icon;
    else element.textContent = label;
    element.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
    });
    return { element };
}

// One of a few choices, side by side. `items` are { key, label, title, lead }: `lead` an element before the label.
// With `fill`, the choices share the width it is given. A press reports the choice; the caller sets it.
function segmented({ items, value = null, size = 'medium', accent = null, fill = false, onChange }) {
    const element = document.createElement('div');
    element.className = 'deckit-segmented';
    element.dataset.size = size;
    element.toggleAttribute('data-fill', fill);
    if (accent) {
        element.dataset.accent = '';
        element.style.setProperty('--deckit-segment-on', accent);
        element.style.setProperty('--deckit-segment-ink', COLOR.onColor(accent));
    }
    const segments = new Map(); // key -> { button, label, lead }
    let current = value;
    const paint = () => {
        for (const [key, { button }] of segments) button.setAttribute('aria-pressed', String(key === current));
    };
    const segmentOf = (key) => {
        const button = buttonOf('deckit-segment', '', size);
        const label = document.createElement('span');
        button.append(label);
        button.addEventListener('click', () => key !== current && onChange?.(key));
        const segment = { button, label, lead: null };
        segments.set(key, segment);
        return segment;
    };
    const setItems = (list) => {
        const keys = new Set(list.map((item) => item.key));
        for (const [key, { button }] of segments) {
            if (keys.has(key)) continue;
            button.remove();
            segments.delete(key);
        }
        for (const item of list) {
            const segment = segments.get(item.key) || segmentOf(item.key);
            segment.label.textContent = item.label;
            segment.button.title = item.title || item.label;
            if (item.lead !== segment.lead) {
                segment.lead?.remove();
                if (item.lead) segment.button.prepend(item.lead);
                segment.lead = item.lead || null;
            }
            element.append(segment.button);
        }
        paint();
    };
    setItems(items);
    return {
        element,
        set: (key) => {
            current = key;
            paint();
        },
        setItems,
        elementOf: (key) => segments.get(key)?.button || null,
    };
}

// A button that stays on or off, beside a text field that keeps the keyboard. A press reports the new state; the
// caller sets it. `setMarked` lights it without turning it on.
function toggleButton({ icon = '', label = '', title, value = false, onChange }) {
    const element = buttonOf('deckit-toggle-button', title, 'medium');
    if (icon) element.innerHTML = icon;
    else element.textContent = label;
    let current = !!value;
    const set = (next) => {
        current = !!next;
        element.setAttribute('aria-pressed', String(current));
    };
    element.addEventListener('mousedown', (event) => event.preventDefault());
    element.addEventListener('click', (event) => {
        event.preventDefault();
        onChange?.(!current);
    });
    set(current);
    return { element, set, setMarked: (on) => element.toggleAttribute('data-marked', !!on) };
}

// A switch. A press reports the new state; the caller sets it.
function toggle({ value = false, onChange }) {
    const element = buttonOf('deckit-toggle', '', 'medium');
    element.setAttribute('role', 'switch');
    const knob = document.createElement('span');
    knob.className = 'deckit-toggle-knob';
    element.append(knob);
    let current = !!value;
    const set = (next) => {
        current = !!next;
        element.setAttribute('aria-checked', String(current));
    };
    element.addEventListener(
        'click',
        unlessDisabled(element, () => onChange?.(!current))
    );
    set(current);
    return { element, set, setEnabled: (on) => setEnabled(element, on) };
}

// The tooltip of `element`, with the chord that does the same when there is one, read again as the pointer comes.
function tooltip(element, { text, chord = () => '' }) {
    const write = () => {
        const keys = chord();
        element.title = keys ? `${text} (${keys})` : text;
    };
    write();
    element.addEventListener('pointerenter', write);
    return () => element.removeEventListener('pointerenter', write);
}

// A button turned off keeps the pointer and its tooltip, and its presses do nothing.
function setEnabled(element, on) {
    if (on) element.removeAttribute('aria-disabled');
    else element.setAttribute('aria-disabled', 'true');
}

function unlessDisabled(element, onClick) {
    return (event) => element.getAttribute('aria-disabled') !== 'true' && onClick?.(event);
}

function buttonOf(kind, title, size) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'deckit-button ' + kind;
    button.dataset.size = size;
    if (title) button.title = title;
    return button;
}

export { STYLE, make };
