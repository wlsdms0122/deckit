module.exports = class {
    start(deckit) {
        this.deckit = deckit;
    }

    stop(...given) {
        return this.deckit.openExternal(`https://example.com/stopped/${given.length}`);
    }
};
