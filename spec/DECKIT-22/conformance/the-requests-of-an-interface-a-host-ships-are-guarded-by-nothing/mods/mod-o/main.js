module.exports = class {
    start(deckit) {
        deckit.exports.register("mod-o/accounts", { connect: () => ({ count: () => 2 }) });
    }
};
