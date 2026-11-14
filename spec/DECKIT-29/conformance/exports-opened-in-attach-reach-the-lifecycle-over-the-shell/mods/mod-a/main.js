module.exports = class {
    attach(shell, deckit) { deckit.exports.register({ connect: () => ({ said: 'attach' }) }); }
};
