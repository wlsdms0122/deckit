module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ opened: "first" }) });
        deckit.exports.register({ connect: () => ({ opened: "second" }) });
    }
};
