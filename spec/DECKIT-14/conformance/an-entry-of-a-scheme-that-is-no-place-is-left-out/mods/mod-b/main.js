module.exports = class {
    start(deckit) {
        deckit.exports.register({
            connect: () => ({
                openURL: (url, options) => deckit.openExternal("https://mod-b.test/", options).then(() => true),
            }),
        });
    }
};
