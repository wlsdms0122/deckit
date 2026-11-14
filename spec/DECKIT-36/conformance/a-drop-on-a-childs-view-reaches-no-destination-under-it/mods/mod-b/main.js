module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        shell.dropDestination(content, { onDrop: (paths, at) => deckit.events.emit('dropped', 'mod-b', paths, at) });
        shell.view.register({ content, didAppear: () => say('mod-b/didAppear'), didDisappear: () => say('mod-b/didDisappear') });
    }
};
