module.exports = class {
    start(deckit) { this.deckit = deckit; }
    async stop() { await this.deckit.openExternal('https://said.test/' + 'stop'); }
};
