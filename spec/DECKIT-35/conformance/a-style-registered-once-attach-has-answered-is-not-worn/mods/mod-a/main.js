module.exports = class {
    attach(shell) {
        setTimeout(() => { shell.styles.register({"*": ":root { --case-b: b; --case-order: b; }\n"}); }, 0);
    }
};
