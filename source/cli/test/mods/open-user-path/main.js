// A headless mod that opens the addresses under one path of the open user's scheme, which it marks on its page as it
// is offered them.
class OpenUserPath {
    start(deckit) {
        deckit.exports.register({
            connect: () => ({
                openURL: (url) => {
                    document.documentElement.dataset.opened = url;
                    return true;
                },
            }),
        });
    }
}

module.exports = OpenUserPath;
