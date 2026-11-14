module.exports = class {
    async start(deckit) {
        const kinds = [];
        try {
            deckit.storage.values.set("note", { text: null });
        } catch (error) {
            kinds.push(error.kind);
        }
        await deckit.storage.records.set("note", [null]).catch((error) => kinds.push(error.kind));
        deckit.storage.values.set("refused", kinds);
    }
};
