module.exports = class {
    attach(shell) {
        return shell.keys.take({ code: 'KeyK', control: true, alt: true }, () => {});
    }
};
