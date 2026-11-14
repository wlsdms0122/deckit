module.exports = class {
    async start(deckit) { this.deckit = deckit; await deckit.openExternal('https://said.test/' + 'start'); }
    async attach(shell, deckit) { await deckit.openExternal('https://said.test/' + 'attach'); }
    async detach() { await this.deckit.openExternal('https://said.test/' + 'detach'); }
    async stop() { await this.deckit.openExternal('https://said.test/' + 'stop'); }
};
