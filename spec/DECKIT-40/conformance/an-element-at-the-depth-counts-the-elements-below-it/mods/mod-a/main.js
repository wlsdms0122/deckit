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
        const heading = put('h1', [0, 60, 720, 40], {}, 'Notes');
        put('button', [0, 100, 100, 30], { 'aria-pressed': 'false' }, 'Bold');
        put('input', [0, 140, 200, 30], { 'aria-label': 'Name', value: 'say "a", b' });
        put('input', [0, 180, 200, 30], { 'aria-label': 'Find' });
        put('input', [0, 220, 20, 20], { type: 'checkbox', 'aria-label': 'Done' });
        const days = put('ul', [0, 250, 200, 120], { 'aria-label': 'Days' });
        ['Mon', 'Tue', 'Wed'].forEach((day, at) => put('li', [0, at * 30, 200, 30], {}, day, days));
        const log = put('section', [0, 380, 200, 60], { 'aria-label': 'Log' });
        log.style.overflow = 'auto';
        ['First line.', 'Second line.', 'Third line.'].forEach((line, at) => put('p', [0, at * 40, 180, 40], {}, line, log));
        deckit.events.on('mod-a:add', () => put('li', [0, 90, 200, 30], {}, 'Thu', days));
        deckit.events.on('mod-a:drop', () => heading.remove());
        shell.windows.open({ name: 'main', content, titleBar: 'unified' });
    }
};
