module.exports = class {
    start(deckit, { web }) {
        deckit.storage.values.set("same", [web.session("a") === web.session("a"), web.session("a") === web.session("b")]);
    }
};
