module.exports = class {
    attach(shell) {
        shell.styles.register({ "*": ":root { --case-a: a; }" });
        shell.styles.register({ "*": ":root { --case-b: b; }" });
    }
};
