module.exports = class {
    async start(deckit) { this.deckit = deckit; await deckit.openExternal('https://said.test/' + 'start'); }
    async attach() { throw new Error('attach is rejected'); }
    async detach() { await this.deckit.openExternal('https://said.test/' + 'detach'); }
};
