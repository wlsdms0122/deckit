module.exports = class {
    start(deckit) {
        deckit.exports.register({
            connect: () => ({
                openURL: (url, options) => deckit.openExternal("https://mod-c.test/", options).then(() => true),
            }),
        });
    }
};
