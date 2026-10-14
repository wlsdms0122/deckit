DeckitModule.define('shell/ui/component/color-picker', { uses: [], provides: ['STYLE', 'make'] }, () => {
    // MARK: - Property
    const STYLE = `
        .deckit-color-area {
            position: relative;
            height: 150px;
            margin-bottom: 12px;
            overflow: hidden;
            border-radius: var(--deckit-radius-medium);
            cursor: crosshair;
            touch-action: none;
        }
        .deckit-color-area::before,
        .deckit-color-area::after { content: ''; position: absolute; inset: 0; }
        .deckit-color-area::before { background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0)); }
        .deckit-color-area::after { background: linear-gradient(to top, #000, rgba(0, 0, 0, 0)); }
        .deckit-color-hue {
            position: relative;
            height: 14px;
            margin-bottom: 12px;
            border-radius: 7px;
            background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
            cursor: ew-resize;
            touch-action: none;
        }
        .deckit-color-knob {
            position: absolute;
            z-index: 1;
            box-sizing: border-box;
            border: 2px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
            pointer-events: none;
        }
        .deckit-color-area .deckit-color-knob { width: 14px; height: 14px; margin: -7px 0 0 -7px; }
        .deckit-color-hue .deckit-color-knob { top: -2px; width: 18px; height: 18px; margin-left: -9px; }
        .deckit-color-readout { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .deckit-color-preview {
            flex: 0 0 auto;
            width: 34px;
            height: 34px;
            border: var(--deckit-border);
            border-radius: var(--deckit-radius-medium);
        }
        .deckit-color-readout .deckit-input { flex: 1 1 auto; min-width: 0; }
    `;
    const START = { hue: 215, saturation: 0.7, value: 0.96 };

    // MARK: - Initializer
    // MARK: - Public
    function make(theme, ui) {
        return { colorPicker: (options) => colorPicker(ui, options) };
    }

    // MARK: - Private
    // A modal to pick a colour by saturation and value, hue, or its hex.
    function colorPicker(ui, { title = 'Pick a colour', value = '#4b8bf4', onPick }) {
        let { hue, saturation, value: brightness } = hsvOf(value) || START;
        let hex = hexOf(hue, saturation, brightness);
        return ui.modal({
            title,
            confirmLabel: 'Use colour',
            onConfirm: () => onPick?.(hex),
            fill(card) {
                const area = element('div', 'deckit-color-area');
                const knob = element('div', 'deckit-color-knob');
                area.append(knob);
                const strip = element('div', 'deckit-color-hue');
                const hueKnob = element('div', 'deckit-color-knob');
                strip.append(hueKnob);
                const readout = element('div', 'deckit-color-readout');
                const preview = element('div', 'deckit-color-preview');
                const field = element('input', 'deckit-input');
                field.spellcheck = false;
                readout.append(preview, field);
                const paint = (typing = false) => {
                    hex = hexOf(hue, saturation, brightness);
                    area.style.background = hexOf(hue, 1, 1);
                    knob.style.left = saturation * 100 + '%';
                    knob.style.top = (1 - brightness) * 100 + '%';
                    knob.style.background = hex;
                    hueKnob.style.left = (hue / 360) * 100 + '%';
                    preview.style.background = hex;
                    if (!typing) field.value = hex;
                };
                follow(area, (x, y) => {
                    saturation = x;
                    brightness = 1 - y;
                    paint();
                });
                follow(strip, (x) => {
                    hue = x * 360;
                    paint();
                });
                field.addEventListener('input', () => {
                    const typed = hsvOf(field.value);
                    if (!typed) return;
                    ({ hue, saturation, value: brightness } = typed);
                    paint(true);
                });
                card.append(area, strip, readout);
                paint();
                return field;
            },
        });
    }

    // `onMove(x, y)` hears where the pointer is over `box`, each from 0 to 1, from the press until the release.
    function follow(box, onMove) {
        const at = (event) => {
            const bounds = box.getBoundingClientRect();
            onMove(
                unit((event.clientX - bounds.left) / bounds.width),
                unit((event.clientY - bounds.top) / bounds.height)
            );
        };
        box.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            box.setPointerCapture(event.pointerId);
            at(event);
        });
        box.addEventListener('pointermove', (event) => box.hasPointerCapture(event.pointerId) && at(event));
    }

    function unit(number) {
        return Math.min(1, Math.max(0, number));
    }

    function hexOf(hue, saturation, value) {
        const channel = (offset) => {
            const k = (offset + hue / 60) % 6;
            return value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1));
        };
        return (
            '#' +
            [channel(5), channel(3), channel(1)]
                .map((part) =>
                    Math.round(part * 255)
                        .toString(16)
                        .padStart(2, '0')
                )
                .join('')
        );
    }

    function hsvOf(text) {
        const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(text || '').trim());
        if (!match) return null;
        const digits = match[1].length === 3 ? match[1].replace(/./g, (digit) => digit + digit) : match[1];
        const [red, green, blue] = [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16) / 255);
        const high = Math.max(red, green, blue);
        const span = high - Math.min(red, green, blue);
        const hue = !span
            ? 0
            : high === red
              ? 60 * (((green - blue) / span) % 6)
              : high === green
                ? 60 * ((blue - red) / span + 2)
                : 60 * ((red - green) / span + 4);
        return { hue: (hue + 360) % 360, saturation: high ? span / high : 0, value: high };
    }

    function element(tag, className) {
        const made = document.createElement(tag);
        made.className = className;
        return made;
    }

    return { STYLE, make };
});
