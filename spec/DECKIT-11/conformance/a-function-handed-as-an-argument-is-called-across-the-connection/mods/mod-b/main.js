module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ subscribe: async (listener) => { await listener("hi"); } }) });
    }
};
