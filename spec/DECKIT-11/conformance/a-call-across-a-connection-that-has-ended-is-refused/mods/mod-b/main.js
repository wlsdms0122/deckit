module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ ping: () => 1 }) });
    }
};
