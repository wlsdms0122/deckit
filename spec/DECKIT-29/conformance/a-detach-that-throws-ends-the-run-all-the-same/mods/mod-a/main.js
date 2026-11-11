module.exports = class {
    start(deckit) { this.deckit = deckit; }
    detach() { throw new Error('detach throws'); }
    async stop() { await this.deckit.openExternal('https://said.test/' + 'stop'); }
};
