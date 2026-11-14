module.exports = class {
    async start(deckit) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await deckit.openExternal("https://example.com/started");
    }
};
