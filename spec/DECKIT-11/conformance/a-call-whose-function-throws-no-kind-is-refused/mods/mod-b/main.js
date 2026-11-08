module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ ping: () => { throw new Error("no"); } }) });
    }
};
