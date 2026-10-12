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
    function iconBtn(svg, title, onClick, { size = 'md', quiet = false } = {}) {
        const button = buttonOf('deckit-icon-button', title);
        button.innerHTML = svg;
        if (size === 'sm') button.dataset.size = 'small';
        if (quiet) button.dataset.muted = '';
        button.addEventListener('click', onClick);
        button.setPressed = (on) => {
            button.setAttribute('aria-pressed', String(!!on));
            return button;
        };
        button.setEnabled = (on) => {
            button.disabled = !on;
            return button;
        };
        button.setIcon = (next) => {
            button.innerHTML = next;
            return button;
        };
        return button;
    }

    function textBtn(text, title, onClick, { size = 'md', icon = '', variant = 'plain' } = {}) {
        const button = buttonOf('deckit-text-button', title);
        const label = document.createElement('span');
        label.textContent = text;
        if (icon) button.insertAdjacentHTML('afterbegin', icon);
        button.append(label);
        if (size === 'sm') button.dataset.size = 'small';
        if (variant !== 'plain') button.dataset.variant = variant;
        button.addEventListener('click', onClick);
        button.setText = (next) => {
            label.textContent = next;
            return button;
        };
        button.setEnabled = (on) => {
            button.disabled = !on;
            return button;
        };
        return button;
    }

    // An action of a row, shown while the row is hovered or holds the focus. Its click is its own, not the row's.
    function miniBtn(label, title, onClick) {
        const button = buttonOf('deckit-row-action', title);
        if (/^\s*<svg/.test(label)) button.innerHTML = label;
        else button.textContent = label;
        button.dataset.deckitReveal = '';
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    // `items` are { key, label, title, lead }: `lead` an element shown before the label.
    function segmented(items, { value = null, onChange, size = 'md', accent = null } = {}) {
        const bar = document.createElement('div');
        bar.className = 'deckit-segmented';
        if (size === 'sm') bar.dataset.size = 'small';
        if (accent) {
            bar.dataset.accent = '';
            bar.style.setProperty('--deckit-segment-on', accent);
        }
        const segments = new Map(); // key -> { button, label, lead }
        let current = value;
        const paint = () => {
            for (const [key, { button }] of segments) button.setAttribute('aria-pressed', String(key === current));
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
                bar.append(segment.button);
            }
            paint();
        };
        const segmentOf = (key) => {
            const button = buttonOf('deckit-segment', '');
            const label = document.createElement('span');
            button.append(label);
            button.addEventListener('click', () => {
                if (current === key) return;
                current = key;
                paint();
                onChange?.(key);
            });
            const segment = { button, label, lead: null };
            segments.set(key, segment);
            return segment;
        };
        setItems(items);
        bar.setItems = setItems;
        bar.setValue = (key) => {
            current = key;
            paint();
        };
        Object.defineProperty(bar, 'value', { get: () => current });
        return bar;
    }

    // A button that stays on or off, beside a text field that keeps the keyboard. `setMarked` lights it without
    // turning it on.
    function toggleButton(label, title, { on = false, onChange } = {}) {
        const button = buttonOf('deckit-toggle-button', title);
        if (/^\s*<svg/.test(label)) button.innerHTML = label;
        else button.textContent = label;
        let value = !!on;
        const paint = () => button.setAttribute('aria-pressed', String(value));
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', (event) => {
            event.preventDefault();
            value = !value;
            paint();
            onChange?.(value);
        });
        button.setMarked = (marked) => {
            button.toggleAttribute('data-marked', !!marked);
            return button;
        };
        Object.defineProperty(button, 'value', {
            get: () => value,
            set: (next) => {
                value = !!next;
                paint();
            },
        });
        paint();
        return button;
    }

    function toggle({ on = false, onChange } = {}) {
        const button = buttonOf('deckit-toggle', '');
        button.setAttribute('role', 'switch');
        const knob = document.createElement('span');
        knob.className = 'deckit-toggle-knob';
        button.append(knob);
        let value = !!on;
        const paint = () => button.setAttribute('aria-checked', String(value));
        button.addEventListener('click', () => {
            value = !value;
            paint();
            onChange?.(value);
        });
        Object.defineProperty(button, 'value', {
            get: () => value,
            set: (next) => {
                value = !!next;
                paint();
            },
        });
        paint();
        return button;
    }

    // The tooltip of `element`, with the chord that does the same when there is one, read again as the pointer comes.
    function tip(element, text, chord) {
        const write = () => {
            const keys = chord?.() || '';
            element.title = keys ? `${text} (${keys})` : text;
        };
        write();
        element.addEventListener('pointerenter', write);
        return element;
    }

    function buttonOf(kind, title) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'deckit-button ' + kind;
        if (title) button.title = title;
        return button;
    }

    return { STYLE, make };
});
