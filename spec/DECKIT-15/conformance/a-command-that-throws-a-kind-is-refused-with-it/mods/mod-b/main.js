module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ runCommand: () => { throw Object.assign(new Error("busy"), { kind: "BUSY" }); } }) });
    }
};
