module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ ping: async () => 2 }) });
    }
};
