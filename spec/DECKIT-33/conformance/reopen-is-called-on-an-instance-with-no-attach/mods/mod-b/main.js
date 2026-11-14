module.exports = class {
    start(deckit) {
        this.deckit = deckit;
    }
    reopen() {
        this.deckit.openExternal('https://said.test/reopen');
    }
};
