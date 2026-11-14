module.exports = class {
    start(deckit) {
        deckit.exports.register("mod-b/pages", { connect: () => { throw new Error("no"); } });
    }
};
