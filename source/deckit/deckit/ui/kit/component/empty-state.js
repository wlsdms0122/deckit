DeckitModule.define(
    'deckit/ui/kit/component/empty-state',
    {
        uses: ['deckit/ui/token'],
        provides: ['make'],
    },
    (TOKEN) => {
        const { icon } = TOKEN;

        return {
            make: (theme, ui, inner) => {
                return {
                    emptyState({ icon: glyph = '', title = '', hint = '', actions = [] } = {}) {
                        const box = document.createElement('div');
                        Object.assign(box.style, {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            flex: '1 1 auto',
                            minHeight: '0',
                            boxSizing: 'border-box',
                            padding: '24px 30px',
                            textAlign: 'center',
                            color: theme.contentColor,
                        });
                        if (glyph) {
                            const mark = document.createElement('div');
                            mark.innerHTML = glyph;
                            Object.assign(mark.style, { display: 'flex', opacity: '.25' });
                            box.appendChild(mark);
                        }
                        const head = document.createElement('div');
                        head.textContent = title;
                        Object.assign(head.style, { font: '700 16px ' + theme.font });
                        const sub = document.createElement('div');
                        sub.textContent = hint;
                        Object.assign(sub.style, {
                            display: hint ? 'block' : 'none',
                            opacity: '.5',
                            font: '12.5px ' + theme.font,
                            lineHeight: '1.6',
                            marginTop: '-4px',
                            maxWidth: '460px',
                        });
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: actions.length ? 'flex' : 'none',
                            gap: '8px',
                            marginTop: '4px',
                        });
                        row.append(...actions);
                        box.append(head, sub, row);
                        box.setTitle = (text) => {
                            head.textContent = text;
                        };
                        box.setHint = (text) => {
                            sub.textContent = text;
                            sub.style.display = text ? 'block' : 'none';
                        };
                        box.setActions = (list) => {
                            row.textContent = '';
                            row.append(...list);
                            row.style.display = list.length ? 'flex' : 'none';
                        };
                        return box;
                    },
                };
            },
        };
    }
);
