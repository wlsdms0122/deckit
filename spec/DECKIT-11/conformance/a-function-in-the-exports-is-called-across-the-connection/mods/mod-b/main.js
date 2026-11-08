module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ ping: (value) => ({ pong: value }) }) });
    }
};
