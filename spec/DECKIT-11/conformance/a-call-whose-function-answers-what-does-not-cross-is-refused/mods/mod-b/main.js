module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ ping: () => { const table = {}; table.self = table; return table; } }) });
    }
};
