module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ completeCommand: (id, param, partial) => ["alpha", "beta"].filter((word) => word.startsWith(partial)).map((value) => ({ value, title: value.toUpperCase() })) }) });
    }
};
