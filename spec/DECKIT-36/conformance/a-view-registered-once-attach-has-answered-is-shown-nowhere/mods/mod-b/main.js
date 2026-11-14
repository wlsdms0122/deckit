module.exports = class {
    attach(shell, deckit) {
        const say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        setTimeout(() => shell.view.register({ content, didAppear: () => say('mod-b/didAppear'), didDisappear: () => say('mod-b/didDisappear') }), 0);
    }
};
