module.exports = class {
    attach(shell, deckit) {
        this.say = (what) => deckit.openExternal('https://said.test/' + what).catch(() => {});
        const content = document.createElement('div');
        shell.view.register({ content, didAppear: () => this.say('mod-b/didAppear'), didDisappear: () => this.say('mod-b/didDisappear') });
    }

    detach() {
        this.say('mod-b/detach');
    }
};
