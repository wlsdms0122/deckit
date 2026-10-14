DeckitModule.define('shell/ui/list/listbox', { uses: ['shell/ui/pointer'], provides: ['listbox'] }, (POINTER) => {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A list with one active option, moved by the keys and by a pointer that travels, and picked by a press.
    // `options` are { element, disabled }. The active option carries `data-active`, which the stylesheet paints.
    // `onActivate(index, { pointer })` hears every move of the active option; `onPick(index, { keyboard })` a pick.
    function listbox(element, { onPick, onActivate = () => {} }) {
        let options = [];
        let active = -1;
        const stopHover = POINTER.hoverIntent(element, (event) => {
            const index = indexAt(event.target);
            if (index >= 0 && !options[index].disabled) activate(index, { pointer: true });
        });
        // On the press, so whatever has the focus keeps it and does not take the click away first.
        const onDown = (event) => {
            event.preventDefault();
            const index = indexAt(event.target);
            if (index >= 0 && !options[index].disabled) onPick(index, { keyboard: false });
        };
        element.addEventListener('mousedown', onDown);

        function indexAt(target) {
            return options.findIndex((option) => option.element.contains(target));
        }

        function set(next, { active: wanted = active } = {}) {
            options = next;
            active = -1;
            paint();
            if (wanted >= 0 && options.length) activate(Math.min(wanted, options.length - 1));
        }

        function activate(index, { pointer = false } = {}) {
            if (options[index]?.disabled) return;
            const changed = index !== active;
            active = index;
            paint();
            if (!pointer) options[active]?.element.scrollIntoView({ block: 'nearest' });
            if (changed) onActivate(active, { pointer });
        }

        // The next option that is not disabled, round the ends; none when every option is.
        function move(by) {
            for (let step = 1, count = options.length; step <= count; step++) {
                const index =
                    active < 0 ? (by > 0 ? step - 1 : count - step) : (((active + by * step) % count) + count) % count;
                if (!options[index].disabled) return activate(index);
            }
            active = -1;
            paint();
        }

        function paint() {
            options.forEach((option, index) => option.element.toggleAttribute('data-active', index === active));
        }

        return {
            set,
            move,
            activate,
            active: () => active,
            dispose: () => {
                stopHover();
                element.removeEventListener('mousedown', onDown);
            },
        };
    }

    // MARK: - Private
    return { listbox };
});
