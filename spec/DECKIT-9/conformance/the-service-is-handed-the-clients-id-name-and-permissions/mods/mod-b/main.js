module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: (connection) => connection });
    }
};
