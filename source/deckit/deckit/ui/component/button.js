DeckitModule.define('deckit/ui/component/button', { uses: [], provides: ['STYLE', 'make'] }, () => {
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
            outline: none;
            background: transparent;
            color: var(--deckit-text);
            font: var(--deckit-type-body);
            cursor: pointer;
            transition:
                background-color var(--deckit-fast) var(--deckit-easing),
                color var(--deckit-fast) var(--deckit-easing),
                opacity var(--deckit-fast) var(--deckit-easing),
                filter var(--deckit-fast) var(--deckit-easing);
        }
        .deckit-button:hover { background: var(--deckit-hover); }
        .deckit-button:active { background: var(--deckit-pressed); }
        .deckit-button:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
        .deckit-button:disabled { background: transparent; color: var(--deckit-disabled); cursor: default; }
        .deckit-icon-button { width: 30px; height: 30px; border-radius: var(--deckit-radius-medium); }
        .deckit-icon-button[data-size='small'] { width: 24px; height: 24px; border-radius: var(--deckit-radius-control); }
        .deckit-icon-button[data-muted]:not(:hover) { color: var(--deckit-muted); }
        .deckit-icon-button[aria-pressed='true'] { color: var(--deckit-accent); }
        .deckit-text-button { height: 30px; padding: 0 11px; border: var(--deckit-border); border-radius: var(--deckit-radius-medium); }
        .deckit-text-button[data-size='small'] {
            height: 24px;
            padding: 0 9px;
            border-radius: var(--deckit-radius-control);
            font: var(--deckit-type-small);
        }
        .deckit-text-button[data-variant='primary'] { --deckit-fill-on: var(--deckit-accent); }
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
        .deckit-text-button[data-variant]:disabled { background: var(--deckit-disabled); filter: none; }
        .deckit-row-action {
            width: 22px;
            height: 22px;
            border-radius: var(--deckit-radius-control);
            color: inherit;
            line-height: 1;
            opacity: 0;
        }
        .deckit-row-action:focus-visible { opacity: 1; }
        .deckit-segmented {
            display: flex;
            flex: 0 0 auto;
            border: var(--deckit-border);
            border-radius: var(--deckit-radius-medium);
            overflow: hidden;
        }
        .deckit-segment {
            gap: 6px;
            padding: 4px 12px;
            border-radius: 0;
            color: var(--deckit-muted);
            font: 600 var(--deckit-type-body);
        }
        .deckit-segmented[data-size='small'] .deckit-segment { padding: 3px 10px; font: 600 var(--deckit-type-small); }
        .deckit-segment[aria-pressed='true'] { background: var(--deckit-selected); color: var(--deckit-text); }
        .deckit-segmented[data-accent] .deckit-segment[aria-pressed='true'] {
            background: var(--deckit-segment-on);
            color: var(--deckit-on-accent);
        }
        .deckit-toggle-button {
            min-width: 22px;
            height: 20px;
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
        .deckit-toggle,
        .deckit-toggle:hover,
        .deckit-toggle:active { background: var(--deckit-disabled); }
        .deckit-toggle[aria-checked='true'] { background: var(--deckit-accent); }
        .deckit-toggle-knob {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            border-radius: var(--deckit-radius-round);
            background: #fff;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            transition: transform var(--deckit-fast) var(--deckit-easing);
        }
        .deckit-toggle[aria-checked='true'] .deckit-toggle-knob { transform: translateX(14px); }
    `;

    // MARK: - Initializer
    // MARK: - Public
    function make() {
        return { iconBtn, textBtn, miniBtn, segmented, toggleButton, toggle, tip };
    }

    // MARK: - Private
    // A button showing an icon. `muted` rests it a step back until the pointer comes.
    function iconBtn({ icon, title, size = 'medium', muted = false, onClick }) {
        const element = buttonOf('deckit-icon-button', title, size);
        element.innerHTML = icon;
        element.toggleAttribute('data-muted', muted);
        element.addEventListener('click', onClick);
        return {
            element,
            setPressed: (on) => element.setAttribute('aria-pressed', String(!!on)),
            setEnabled: (on) => (element.disabled = !on),
            setIcon: (next) => (element.innerHTML = next),
        };
    }

    function textBtn({ label, title = '', icon = '', size = 'medium', variant = 'plain', onClick }) {
        const element = buttonOf('deckit-text-button', title, size);
        const text = document.createElement('span');
        text.textContent = label;
        if (icon) element.insertAdjacentHTML('afterbegin', icon);
        element.append(text);
        if (variant !== 'plain') element.dataset.variant = variant;
        element.addEventListener('click', onClick);
        return {
            element,
            setLabel: (next) => (text.textContent = next),
            setEnabled: (on) => (element.disabled = !on),
        };
    }

    // An action of a row, shown while the row is hovered or holds the focus. Its click is its own, not the row's.
    function miniBtn({ icon = '', label = '', title, onClick }) {
        const element = buttonOf('deckit-row-action', title, 'medium');
        if (icon) element.innerHTML = icon;
        else element.textContent = label;
        element.dataset.deckitReveal = '';
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });
        return { element };
    }

    // One of a few choices, side by side. `items` are { key, label, title, lead }: `lead` an element before the label.
    // A press reports the choice; the owner sets it.
    function segmented({ items, value = null, size = 'medium', accent = null, onChange }) {
        const element = document.createElement('div');
        element.className = 'deckit-segmented';
        element.dataset.size = size;
        if (accent) {
            element.dataset.accent = '';
            element.style.setProperty('--deckit-segment-on', accent);
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
        };
    }

    // A button that stays on or off, beside a text field that keeps the keyboard. A press reports the new state; the
    // owner sets it. `setMarked` lights it without turning it on.
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

    // A switch. A press reports the new state; the owner sets it.
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
        element.addEventListener('click', () => onChange?.(!current));
        set(current);
        return { element, set };
    }

    // The tooltip of `element`, with the chord that does the same when there is one, read again as the pointer comes.
    function tip(element, { text, chord = () => '' }) {
        const write = () => {
            const keys = chord();
            element.title = keys ? `${text} (${keys})` : text;
        };
        write();
        element.addEventListener('pointerenter', write);
        return () => element.removeEventListener('pointerenter', write);
    }

    function buttonOf(kind, title, size) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'deckit-button ' + kind;
        button.dataset.size = size;
        if (title) button.title = title;
        return button;
    }

    return { STYLE, make };
});
