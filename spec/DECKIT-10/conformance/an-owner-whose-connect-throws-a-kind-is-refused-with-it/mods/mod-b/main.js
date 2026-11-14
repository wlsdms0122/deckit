module.exports = class {
    start(deckit) {
        deckit.exports.register("mod-b/pages", { connect: () => { throw Object.assign(new Error("busy"), { kind: "BUSY" }); } });
    }
};
