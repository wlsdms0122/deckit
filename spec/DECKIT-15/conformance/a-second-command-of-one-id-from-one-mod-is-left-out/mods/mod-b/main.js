module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ runCommand: (id, args) => (id === "echo" ? args.text : 1) }) });
    }
};
