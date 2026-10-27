// A child that marks on its page whether its view is on screen.
class RegionChild {
    attach(shell) {
        const shown = (on) => () => (document.documentElement.dataset.shown = on);
        shell.view({
            content: document.createElement('div'),
            parent: 'region-parent',
            didAppear: shown('yes'),
            didDisappear: shown('no'),
        });
    }
}

module.exports = RegionChild;
