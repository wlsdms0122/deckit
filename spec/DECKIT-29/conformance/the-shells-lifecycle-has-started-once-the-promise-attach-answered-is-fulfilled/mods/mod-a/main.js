module.exports = class {
    async attach(shell) { await new Promise((done) => setTimeout(done, 300)); shell.windows.open({ name: 'main', content: document.createElement('div') }); }
};
