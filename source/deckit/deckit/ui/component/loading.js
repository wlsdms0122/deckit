DeckitModule.define(
    'deckit/ui/component/loading',
    {
        uses: ['deckit/ui/token'],
        provides: ['make'],
    },
    (TOKEN) => {
        const { MOTION } = TOKEN;

        return {
            make: (theme, ui, inner) => {
                return {
                    spinner(size = 14) {
                        const el = document.createElement('span');
                        Object.assign(el.style, {
                            flex: '0 0 auto',
                            width: size + 'px',
                            height: size + 'px',
                            borderRadius: '999px',
                            border: '2px solid currentColor',
                            borderTopColor: 'transparent',
                            opacity: '.55',
                            boxSizing: 'border-box',
                            display: 'inline-block',
                        });
                        if (parseFloat(MOTION.base)) {
                            el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
                                duration: 750,
                                iterations: Infinity,
                            });
                        }
                        return el;
                    },
                    loading(text = '') {
                        const box = document.createElement('div');
                        Object.assign(box.style, {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            padding: '24px 12px',
                            font: '13px ' + theme.font,
                            textAlign: 'center',
                        });
                        box.appendChild(ui.spinner(20));
                        if (text) {
                            const t = document.createElement('div');
                            t.textContent = text;
                            t.style.opacity = '.6';
                            box.appendChild(t);
                        }
                        return box;
                    },
                };
            },
        };
    }
);
