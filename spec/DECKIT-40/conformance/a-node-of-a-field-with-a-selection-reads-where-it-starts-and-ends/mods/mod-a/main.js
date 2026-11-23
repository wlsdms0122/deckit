module.exports = class {
    attach(shell, deckit) {
        const content = document.createElement('div');
        const put = (tag, [left, top, width, height], attributes = {}, text = '', parent = content) => {
            const element = document.createElement(tag);
            for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
            element.textContent = text;
            element.style.cssText =
                'position:absolute;box-sizing:border-box;margin:0;border:0;padding:0;' +
                `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
            parent.append(element);
            return element;
        };
        put('input', [0, 60, 200, 30], { type: 'password', 'aria-label': 'Secret', value: 'abc' });
        put('div', [0, 100, 200, 30], { contenteditable: 'true', 'aria-label': 'Draft' }, 'Hello');
        const span = put('input', [0, 140, 200, 30], { 'aria-label': 'Span', value: 'abcdef' });
        const auto = put('input', [0, 180, 200, 30], { 'aria-label': 'Auto' });
        const feed = put('section', [0, 220, 200, 60], { 'aria-label': 'Feed' });
        feed.style.overflow = 'auto';
        const [, , third] = ['One', 'Two', 'Three'].map((name, at) => put('button', [0, at * 40, 180, 40], {}, name, feed));
        deckit.events.on('mod-a:rename', () => (third.textContent = 'Four'));
        const aside = put('div', [0, 290, 200, 20], { role: 'note' }, 'Aside');
        deckit.events.on('mod-a:bare', () => aside.removeAttribute('role'));
        shell.windows.open({ name: 'main', content, titleBar: 'unified', didAppear: () => (span.setSelectionRange(1, 4), auto.focus()) });
    }
};
