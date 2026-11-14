module.exports = class {
    async start() {
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
};
