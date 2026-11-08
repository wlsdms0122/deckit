class Counter {
    constructor() {
        this.n = 3;
    }
    count() {
        return this.n;
    }
}

module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => new Counter() });
    }
};
