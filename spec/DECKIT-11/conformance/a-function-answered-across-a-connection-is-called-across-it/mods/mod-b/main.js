module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ make: () => ({ add: (one, other) => one + other }) }) });
    }
};
