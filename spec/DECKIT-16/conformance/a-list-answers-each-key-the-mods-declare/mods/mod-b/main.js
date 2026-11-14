module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ runCommand: () => 1 }) });
    }
};
