module.exports = class {
    start(deckit) {
        deckit.exports.register({
            connect: () => {
                throw Object.assign(new Error("busy"), { kind: "BUSY" });
            },
        });
    }
};
