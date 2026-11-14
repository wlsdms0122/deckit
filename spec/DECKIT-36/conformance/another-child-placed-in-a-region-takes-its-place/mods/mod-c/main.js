module.exports = class {
    attach(shell) {
        shell.view.register({ content: document.createElement('div') });
    }
};
