module.exports = class {
    start(deckit) {
        deckit.exports.register({
            connect: () => ({ text: "page", number: 3, flag: false, list: [1, "two"], table: { key: "value" } }),
        });
    }
};
