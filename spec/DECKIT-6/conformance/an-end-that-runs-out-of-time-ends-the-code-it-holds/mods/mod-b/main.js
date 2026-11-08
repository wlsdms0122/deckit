module.exports = class {
    start(deckit) {
        this.deckit = deckit;
    }

    stop() {
        setInterval(() => this.deckit.openExternal("https://example.com/after-the-end"), 6000);
        return new Promise(() => {});
    }
};
