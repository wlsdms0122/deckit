module.exports = class {
    async start(deckit) { this.deckit = deckit; await deckit.openExternal('https://said.test/' + 'start'); }
    attach() { throw new Error('attach throws'); }
    async detach() { await this.deckit.openExternal('https://said.test/' + 'detach'); }
};
