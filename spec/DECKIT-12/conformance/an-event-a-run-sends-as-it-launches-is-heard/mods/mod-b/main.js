module.exports = class {
    start(deckit) {
        deckit.events.emit("ready", "launching");
    }
};
