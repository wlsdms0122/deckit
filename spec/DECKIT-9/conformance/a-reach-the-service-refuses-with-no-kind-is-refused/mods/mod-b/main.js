module.exports = class {
    start(deckit) {
        deckit.exports.register({
            connect: () => {
                throw new Error("busy");
            },
        });
    }
};
