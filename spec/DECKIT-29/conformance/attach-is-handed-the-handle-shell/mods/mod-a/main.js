module.exports = class {
    attach(shell) { shell.windows.open({ name: 'main', content: document.createElement('div') }); }
};
