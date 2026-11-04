// A parent that shows its first board in a region inside its sidebar.
class RegionParent {
    attach(shell) {
        const content = document.createElement('div');
        const sidebar = document.createElement('div');
        const slot = document.createElement('div');
        slot.id = 'region-slot';
        slot.style.height = '120px';
        sidebar.append(slot);
        shell.view.register({ content, sidebar });
        const region = shell.region(slot, 'region-parent/boards');
        const placeFirst = () => {
            const [first] = shell.children.list('region-parent/boards');
            if (first) region.place(first.id);
        };
        shell.children.onChange(placeFirst);
        placeFirst();
    }
}

module.exports = RegionParent;
