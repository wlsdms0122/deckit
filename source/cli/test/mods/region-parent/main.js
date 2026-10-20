// A parent that shows its first child in a region inside its sidebar, and asks a main process module of its own what
// it finds of the window the panel is in.
module.exports = {
    start(deck) {
        const content = document.createElement('div');
        const sidebar = document.createElement('div');
        const slot = document.createElement('div');
        slot.id = 'region-slot';
        slot.style.height = '120px';
        sidebar.append(slot);
        deck.view({ content, sidebar });
        const region = deck.region(slot);
        const placeFirst = () => {
            const [first] = deck.children.list();
            if (first) region.place(first.id);
        };
        deck.children.onChange(placeFirst);
        placeFirst();
        // The test asks what a main process module finds of the window the panel is in.
        document.addEventListener('test-stack', async () => {
            const probe = await deck.mainProcess('main-process/stack.js');
            document.documentElement.dataset.stack = JSON.stringify(await probe.stack());
        });
    },
};
