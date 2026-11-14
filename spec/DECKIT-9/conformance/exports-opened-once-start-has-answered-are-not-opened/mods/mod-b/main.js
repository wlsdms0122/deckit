module.exports = class {
    start(deckit) {
        setTimeout(() => deckit.exports.register({ connect: () => ({ ready: true }) }), 0);
    }
};
