module.exports = class {
    start(deckit) { this.deckit = deckit; }
    async detach() { await this.deckit.openExternal('https://said.test/' + 'detach'); }
    async stop() { await this.deckit.openExternal('https://said.test/' + 'stop'); }
};
