module.exports = class {
    attach(shell, deckit) {
        const content = document.createElement('div');
        shell.windows.open({ name: 'main', content });
        const element = document.createElement('div');
        Object.assign(element.style, { position: 'fixed', left: '100px', top: '100px', width: '200px', height: '150px' });
        content.append(element);
        const region = shell.region(element, 'case/view');
        deckit.events.on('mod-a:go', (id) => region.place(id));
    }
};
