module.exports = class {
    attach(shell) {
        shell.styles.register({"*": ":root { --case-order: a; }"});
    }
};
