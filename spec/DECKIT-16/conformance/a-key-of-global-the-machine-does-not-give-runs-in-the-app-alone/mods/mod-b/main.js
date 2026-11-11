module.exports = class {
    start(deckit) {
        deckit.exports.register({
            connect: () => ({
                runCommand: (id) => {
                    deckit.openExternal('https://said.test/ran/' + id).catch(() => {});
                    return 1;
                },
            }),
        });
    }
};
