// A parent that shows its first board in a region of its window.
class RegionParent {
    attach(shell) {
        const content = document.createElement('div');
        const slot = document.createElement('div');
        slot.id = 'region-slot';
        Object.assign(slot.style, { width: '200px', height: '120px', margin: '60px 0 0 40px' });
        content.append(slot);
        this.open = () => shell.windows.open({ name: 'main', content, width: 480, height: 320 });
        this.open();
        const region = shell.region(slot, 'region-parent/boards');
        const placeFirst = async () => {
            const [first] = await shell.children.list('region-parent/boards');
            if (first) await region.place(first.id);
        };
        shell.children.onChange(placeFirst);
        placeFirst();
    }

    reopen() {
        this.open?.();
    }

    detach() {
        this.open = null;
    }
}

module.exports = RegionParent;
