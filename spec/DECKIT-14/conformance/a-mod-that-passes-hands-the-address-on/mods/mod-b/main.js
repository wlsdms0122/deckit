module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ openURL: () => false }) });
    }
};
