module.exports = class {
    async start(deckit) { await new Promise((done) => setTimeout(done, 300)); await deckit.openExternal('https://said.test/' + 'start'); }
    async attach(shell, deckit) { await deckit.openExternal('https://said.test/' + 'attach'); }
};
