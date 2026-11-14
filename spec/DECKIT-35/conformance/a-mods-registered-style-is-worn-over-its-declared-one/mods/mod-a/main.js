module.exports = class {
    attach(shell) {
        shell.styles.register({"*": ":root { --case-b: b; --case-order: b; }\n"});
    }
};
