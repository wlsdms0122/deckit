module.exports = class {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ ping: () => { throw Object.assign(new Error("busy"), { kind: "BUSY" }); } }) });
    }
};
