module.exports = class {
    start(deckit, frameworks) {
        deckit.storage.values.set("frameworks", Object.keys(frameworks));
    }
};
