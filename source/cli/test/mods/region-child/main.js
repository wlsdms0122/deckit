// A child that marks on its page whether its view is on screen.
module.exports = {
    start(deck) {
        const shown = (on) => () => (document.documentElement.dataset.shown = on);
        deck.view({
            content: document.createElement('div'),
            parent: 'region-parent',
            didAppear: shown('yes'),
            didDisappear: shown('no'),
        });
    },
};
