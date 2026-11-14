module.exports = class {
    async start(deckit) {
        await deckit.storage.records.set("note", { text: "a", none: undefined });
        deckit.storage.values.set("note", { text: "a", none: undefined });
        const read = [deckit.storage.records.get("note"), deckit.storage.values.get("note")];
        deckit.storage.values.set("kept", read.map((note) => Object.keys(note)));
    }
};
