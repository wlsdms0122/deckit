// A headless mod that asks for the addresses under one path of the open user's scheme, which it marks on its page as
// it is offered them.
class OpenUserPath {
    start(deckit) {
        deckit.urls.register((url) => {
            document.documentElement.dataset.opened = url;
            return true;
        });
    }
}

module.exports = OpenUserPath;
