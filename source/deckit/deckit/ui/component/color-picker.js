DeckitModule.define('deckit/ui/component/color-picker', { uses: [], provides: ['make'] }, () => {
    const clamp01 = (n) => Math.min(1, Math.max(0, n));
    const toHex = (n) =>
        Math.round(n * 255)
            .toString(16)
            .padStart(2, '0');

    const hsvToHex = (h, s, v) => {
        const f = (n) => {
            const k = (n + h / 60) % 6;
            return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
        };
        return '#' + toHex(f(5)) + toHex(f(3)) + toHex(f(1));
    };

    const hexToHsv = (hex) => {
        const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex || '').trim());
        if (!m) return null;
        const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
        const max = Math.max(r, g, b),
            min = Math.min(r, g, b),
            d = max - min;
        const h =
            d === 0
                ? 0
                : max === r
                  ? 60 * (((g - b) / d) % 6)
                  : max === g
                    ? 60 * ((b - r) / d + 2)
                    : 60 * ((r - g) / d + 4);
        return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
    };

    return {
        make: (theme, ui) => {
            return {
                colorPicker({ title = 'Pick a colour', value = '#4b8bf4', onPick }) {
                    let { h, s, v } = hexToHsv(value) || { h: 215, s: 0.7, v: 0.96 };
                    let hex = hsvToHex(h, s, v);

                    return ui.sheet({
                        title,
                        confirmLabel: 'Use colour',
                        onConfirm: () => onPick?.(hex),
                        fill(card) {
                            const area = document.createElement('div');
                            Object.assign(area.style, {
                                position: 'relative',
                                height: '150px',
                                borderRadius: '8px',
                                cursor: 'crosshair',
                                marginBottom: '12px',
                                overflow: 'hidden',
                                touchAction: 'none',
                            });
                            const white = document.createElement('div');
                            const black = document.createElement('div');
                            Object.assign(white.style, {
                                position: 'absolute',
                                inset: '0',
                                background: 'linear-gradient(to right, #fff, rgba(255,255,255,0))',
                            });
                            Object.assign(black.style, {
                                position: 'absolute',
                                inset: '0',
                                background: 'linear-gradient(to top, #000, rgba(0,0,0,0))',
                            });
                            const knob = document.createElement('div');
                            Object.assign(knob.style, {
                                position: 'absolute',
                                width: '14px',
                                height: '14px',
                                marginLeft: '-7px',
                                marginTop: '-7px',
                                borderRadius: '50%',
                                border: '2px solid #fff',
                                boxShadow: '0 0 0 1px rgba(0,0,0,.45)',
                                pointerEvents: 'none',
                            });
                            area.append(white, black, knob);

                            const hue = document.createElement('div');
                            Object.assign(hue.style, {
                                position: 'relative',
                                height: '14px',
                                borderRadius: '7px',
                                cursor: 'ew-resize',
                                marginBottom: '12px',
                                touchAction: 'none',
                                background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                            });
                            const hueKnob = document.createElement('div');
                            Object.assign(hueKnob.style, {
                                position: 'absolute',
                                top: '-2px',
                                width: '18px',
                                height: '18px',
                                marginLeft: '-9px',
                                borderRadius: '50%',
                                border: '2px solid #fff',
                                boxShadow: '0 0 0 1px rgba(0,0,0,.45)',
                                pointerEvents: 'none',
                                boxSizing: 'border-box',
                            });
                            hue.appendChild(hueKnob);

                            const readout = document.createElement('div');
                            Object.assign(readout.style, {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '14px',
                            });
                            const preview = document.createElement('div');
                            Object.assign(preview.style, {
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                flex: '0 0 auto',
                                border: theme.border,
                            });
                            const field = document.createElement('input');
                            field.spellcheck = false;
                            Object.assign(field.style, {
                                flex: '1 1 auto',
                                minWidth: '0',
                                height: '32px',
                                padding: '0 10px',
                                borderRadius: '8px',
                                border: theme.border,
                                background: 'rgba(128,128,128,.12)',
                                color: 'inherit',
                                font: '14px ' + theme.font,
                                outline: 'none',
                            });
                            readout.append(preview, field);

                            const paint = (typing) => {
                                hex = hsvToHex(h, s, v);
                                area.style.background = hsvToHex(h, 1, 1);
                                knob.style.left = s * 100 + '%';
                                knob.style.top = (1 - v) * 100 + '%';
                                knob.style.background = hex;
                                hueKnob.style.left = (h / 360) * 100 + '%';
                                preview.style.background = hex;
                                if (!typing) field.value = hex;
                            };

                            const drag = (el, onMove) => {
                                const apply = (e) => {
                                    const box = el.getBoundingClientRect();
                                    onMove(
                                        clamp01((e.clientX - box.left) / box.width),
                                        clamp01((e.clientY - box.top) / box.height)
                                    );
                                    paint();
                                };
                                el.addEventListener('mousedown', (e) => {
                                    e.preventDefault();
                                    apply(e);
                                    const move = (ev) => apply(ev);
                                    const up = () => {
                                        document.removeEventListener('mousemove', move);
                                        document.removeEventListener('mouseup', up);
                                    };
                                    document.addEventListener('mousemove', move);
                                    document.addEventListener('mouseup', up);
                                });
                            };
                            drag(area, (x, y) => {
                                s = x;
                                v = 1 - y;
                            });
                            drag(hue, (x) => {
                                h = x * 360;
                            });

                            field.addEventListener('input', () => {
                                const parsed = hexToHsv(field.value);
                                if (!parsed) return;
                                ({ h, s, v } = parsed);
                                paint(true);
                            });

                            card.append(area, hue, readout);
                            paint();
                            return field;
                        },
                    });
                },
            };
        },
    };
});
