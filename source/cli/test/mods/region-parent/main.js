// A parent that shows its first child in a region inside its sidebar.
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
    },
};
