module.exports = class {
    start(deckit) {
        this.deckit = deckit;
        throw new Error("not yet");
    }

    stop() {
        return this.deckit.openExternal("https://example.com/stopped");
    }
};
