module.exports = class {
    async attach(shell, deckit, frameworks) { await frameworks.web.session('main').clear(); await deckit.openExternal('https://said.test/' + 'attach'); }
};
