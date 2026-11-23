// A window that holds a heading, and a menu its page presents over itself as the event mod-a:menu tells it.
module.exports = class {
    attach(shell, deckit) {
        const content = document.createElement('div');
        const heading = document.createElement('h1');
        heading.textContent = 'Notes';
        heading.style.cssText = 'position:absolute;margin:0;left:0;top:60px;width:720px;height:40px';
        content.append(heading);
        deckit.events.on('mod-a:menu', () =>
            shell.ui.menu({ items: [{ label: 'Keep', run: () => {} }], point: { x: 100, y: 120 } })
        );
        shell.windows.open({ name: 'main', content, titleBar: 'unified' });
    }
};
