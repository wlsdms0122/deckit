module.exports = class {
    async start(deckit) {
        await deckit.storage.records.set("half", 0.5);
        deckit.storage.values.set("half", 0.5);
        const kept = [deckit.storage.records.get("half"), deckit.storage.values.get("half")];
        deckit.storage.values.set("kept", kept.map((half) => half === 0.5));
    }
};
