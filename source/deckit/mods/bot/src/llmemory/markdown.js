const { styled } = require('../dom.js');

const renderMarkdown = ({ ui, onNote, onLink, wrap, copyText }) => {
    const LINK = 'var(--deckit-accent)';
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

    const INLINE = new RegExp(
        [
            /`([^`]+)`/.source,

            /\*\*(?=\S)(.+?)(?<=\S)\*\*/.source,
            /(?<![\w*])\*(?![\s*])([^*\n]+?)(?<!\s)\*(?![\w*])/.source,
            /(?<!\w)_(?![\s_])([^_\n]+?)(?<!\s)_(?!\w)/.source,
            /~~([^~]+)~~/.source,
            /\[\[([^\]]+)\]\]/.source,
            /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.source,
            /(https?:\/\/[^\s)>\]]+)/.source,
        ].join('|'),
        'g'
    );

    const link = (url, content, style = {}) => {
        const anchor = styled('a', {
            color: LINK,
            wordBreak: 'break-all',
            textDecoration: 'none',
            cursor: 'pointer',
            ...style,
        });
        anchor.append(content);
        anchor.href = url;
        anchor.title = url;
        anchor.addEventListener('mouseenter', () => {
            anchor.style.textDecoration = 'underline';
        });
        anchor.addEventListener('mouseleave', () => {
            anchor.style.textDecoration = 'none';
        });
        anchor.addEventListener('click', (event) => {
            event.preventDefault();
            onLink(url);
        });
        return anchor;
    };
    const CODE_STYLE = {
        font: '12px ' + MONO,
        padding: '1px 5px',
        borderRadius: '4px',
        background: 'rgba(128,128,128,.16)',
    };

    const inline = (text) => {
        const fragment = document.createDocumentFragment();
        const pattern = new RegExp(INLINE.source, 'g');
        let last = 0,
            match;
        while ((match = pattern.exec(text))) {
            if (match.index > last) fragment.append(text.slice(last, match.index));
            const [, code, bold, star, under, strike, note, label, href, bare] = match;
            if (code != null) {
                const codeElement = styled('code', CODE_STYLE, code);
                fragment.append(/^https?:\/\/\S+$/.test(code.trim()) ? link(code.trim(), codeElement) : codeElement);
            } else if (bold != null) {
                const strong = styled('strong', { fontWeight: '700' });
                strong.append(inline(bold));
                fragment.append(strong);
            } else if (star != null || under != null) {
                const emphasis = styled('em', { fontStyle: 'italic' });
                emphasis.append(inline(star ?? under));
                fragment.append(emphasis);
            } else if (strike != null) {
                const struck = styled('s', { opacity: '.6' });
                struck.append(inline(strike));
                fragment.append(struck);
            } else if (note != null) {
                const id = note.split('|')[0].trim();
                const anchor = styled(
                    'span',
                    { color: LINK, cursor: 'pointer' },
                    note.includes('|') ? note.split('|')[1].trim() : id
                );
                anchor.title = 'Open ' + id;
                anchor.addEventListener('mouseenter', () => {
                    anchor.style.textDecoration = 'underline';
                });
                anchor.addEventListener('mouseleave', () => {
                    anchor.style.textDecoration = 'none';
                });
                anchor.addEventListener('click', () => onNote(id));
                fragment.append(anchor);
            } else {
                const url = href || bare;
                fragment.append(link(url, label || url));
            }
            last = pattern.lastIndex;
        }
        if (last < text.length) fragment.append(text.slice(last));
        return fragment;
    };

    const applyWrap = (pre, on) => {
        pre.style.whiteSpace = on ? 'pre-wrap' : 'pre';
        pre.style.overflowWrap = on ? 'anywhere' : 'normal';
    };
    const paintWrap = (button, on) => {
        button.setPressed(on);
        button.element.title = on
            ? 'Stop wrapping long lines, in every code block'
            : 'Wrap long lines, in every code block';
    };

    const drawn = new Set();
    const repaintWrap = () => {
        for (const block of drawn) {
            if (!block.pre.isConnected) {
                drawn.delete(block);
                continue;
            }
            applyWrap(block.pre, wrap.get());
            paintWrap(block.button, wrap.get());
        }
    };
    wrap.on(repaintWrap);
    const barButton = (glyph, title, onClick) =>
        ui.iconButton({ icon: ui.icon(glyph, { size: 14 }), title, size: 'small', muted: true, onClick });
    const codeBlock = (text, language) => {
        const box = styled('div', {
            margin: '0 0 12px',
            border: 'var(--deckit-border)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'rgba(128,128,128,.08)',
        });
        const head = styled('div', {
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '2px 4px 2px 12px',
            borderBottom: 'var(--deckit-border)',
            background: 'rgba(128,128,128,.08)',
        });
        head.append(
            styled(
                'span',
                {
                    flex: '1 1 auto',
                    minWidth: '0',
                    opacity: '.55',
                    font: '600 10.5px var(--deckit-font)',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                },
                language || 'text'
            )
        );
        const pre = styled(
            'pre',
            {
                margin: '0',
                padding: '10px 12px',
                overflowX: 'auto',
                font: '12px/1.55 ' + MONO,
            },
            text
        );
        applyWrap(pre, wrap.get());

        const copy = barButton('copy', 'Copy this block', () => {
            Promise.resolve(copyText(text)).then(
                () => {
                    copy.setIcon(ui.icon('check', { size: 14 }));
                    copy.setPressed(true);
                    setTimeout(() => {
                        copy.setIcon(ui.icon('copy', { size: 14 }));
                        copy.setPressed(false);
                    }, 1200);
                },
                () => {}
            );
        });
        const wrapButton = barButton('wrapText', '', () => {
            wrap.set(!wrap.get());
        });
        paintWrap(wrapButton, wrap.get());
        drawn.add({ pre, button: wrapButton });
        head.append(wrapButton.element, copy.element);
        box.append(head, pre);
        return box;
    };

    const HEADING_SIZE = [0, 19, 16.5, 15, 14, 13.5, 13.5];
    const cells = (line) =>
        line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());

    const render = (source) => {
        const root = styled('div', { font: '13.5px var(--deckit-font)', lineHeight: '1.65' });
        const lines = String(source || '')
            .replace(/\r\n?/g, '\n')
            .split('\n');
        let paragraph = [],
            lastItem = null;
        const flush = () => {
            if (paragraph.length) {
                const paragraphElement = styled('p', { margin: '0 0 10px' });
                paragraphElement.append(inline(paragraph.join(' ')));
                root.append(paragraphElement);
            }
            paragraph = [];
        };
        const block = () => {
            flush();
            lastItem = null;
        };

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const fence = line.match(/^\s*```\s*([\w+#.-]*)/);
            if (fence) {
                block();
                const fenced = [];
                while (++index < lines.length && !/^\s*```/.test(lines[index])) fenced.push(lines[index]);
                root.append(codeBlock(fenced.join('\n'), fence[1]));
                continue;
            }
            if (!line.trim()) {
                block();
                continue;
            }
            if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
                block();
                root.append(styled('div', { borderTop: 'var(--deckit-border)', margin: '14px 0' }));
                continue;
            }
            const heading = line.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                block();
                const level = heading[1].length;
                const head = styled('div', {
                    margin: root.childNodes.length ? '20px 0 8px' : '0 0 8px',
                    font: `700 ${HEADING_SIZE[level]}px/1.4 var(--deckit-font)`,
                    borderRadius: '4px',
                });
                head.append(inline(heading[2].trim()));
                head.dataset.heading = heading[2].trim();
                head.dataset.level = String(level);
                root.append(head);
                continue;
            }
            if (/^\s*\|/.test(line)) {
                block();
                const tableLines = [];
                for (; index < lines.length && /^\s*\|/.test(lines[index]); index++) tableLines.push(lines[index]);
                index--;

                const body = tableLines
                    .filter((tableLine) => !cells(tableLine).every((cell) => /^:?-+:?$/.test(cell)))
                    .map(cells);
                const scroller = styled('div', { margin: '0 0 12px', overflowX: 'auto' });
                const table = styled('table', { borderCollapse: 'collapse', font: '12.5px/1.5 var(--deckit-font)' });
                body.forEach((row, rowIndex) => {
                    const rowElement = styled('tr');
                    for (const cell of row) {
                        const cellElement = styled(rowIndex === 0 ? 'th' : 'td', {
                            border: 'var(--deckit-border)',
                            padding: '4px 9px',
                            textAlign: 'left',
                            verticalAlign: 'top',
                            fontWeight: rowIndex === 0 ? '700' : '400',
                        });
                        cellElement.append(inline(cell));
                        rowElement.append(cellElement);
                    }
                    table.append(rowElement);
                });
                scroller.append(table);
                root.append(scroller);
                continue;
            }

            const listItem = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
            if (listItem) {
                flush();
                const depth = Math.floor(listItem[1].replace(/\t/g, '  ').length / 2);
                const item = styled('div', {
                    display: 'flex',
                    gap: '6px',
                    margin: '0 0 4px',
                    paddingLeft: depth * 18 + 'px',
                });
                const ordered = /\d/.test(listItem[2]);
                const check = listItem[3].match(/^\[([ xX])\]\s+(.*)$/);
                const marker = check ? (check[1] === ' ' ? '☐' : '☑') : ordered ? listItem[2] : '•';
                item.append(
                    styled('span', { flex: '0 0 auto', minWidth: ordered ? '18px' : '10px', opacity: '.55' }, marker)
                );
                const text = styled('div', { minWidth: '0' });
                text.append(inline(check ? check[2] : listItem[3]));
                if (check && check[1] !== ' ') text.style.opacity = '.6';
                item.append(text);
                root.append(item);
                lastItem = text;
                continue;
            }
            const quoted = line.match(/^\s*((?:>\s?)+)(.*)$/);
            if (quoted) {
                block();
                const previous = root.lastChild;
                const quote =
                    previous && previous.dataset && previous.dataset.quote
                        ? previous
                        : styled('div', {
                              margin: '0 0 12px',
                              padding: '2px 12px',
                              borderLeft: '3px solid rgba(128,128,128,.4)',
                              opacity: '.8',
                          });
                if (quote !== previous) {
                    quote.dataset.quote = '1';
                    root.append(quote);
                } else quote.append(styled('br'));
                quote.append(inline(quoted[2]));
                continue;
            }
            if (lastItem && /^\s+\S/.test(line)) {
                lastItem.append(' ', inline(line.trim()));
                continue;
            }
            lastItem = null;
            paragraph.push(line.trim());
        }
        flush();
        return root;
    };
    render.link = link;
    return render;
};

module.exports = { renderMarkdown };
