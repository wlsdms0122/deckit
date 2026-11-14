module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        shell.view.register({ content, didAppear: () => say('mod-c/didAppear'), didDisappear: () => say('mod-c/didDisappear') });
    }
};
