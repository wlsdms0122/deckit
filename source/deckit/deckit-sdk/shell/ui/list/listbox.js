import * as POINTER from '../pointer/index.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A list with one active option, moved by the keys and by a pointer that travels, and picked by a press.
// `options` are { element, disabled }. The active option carries `data-active`, which the stylesheet paints.
// `onActivate(index, { pointer })` hears every move of the active option; `onPick(index, { keyboard })` a pick.
function listbox(element, { onPick, onActivate = () => {} }) {
    let options = [];
    let active = -1;
    let pointed = false; // whether the pointer made the active option active, so it is where the pointer is
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

    // The option the pointer made active stays where it is in view; any other is brought into it.
    function set(next, { active: wanted = active } = {}) {
        const shown = pointed ? options[active]?.element : null;
        options = next;
        active = -1;
        paint();
        if (wanted < 0 || !options.length) return;
        const index = Math.min(wanted, options.length - 1);
        const kept = !!shown && options[index].element === shown;
        activate(index, { reveal: !kept });
        pointed = kept;
    }

    // Brought into view unless the pointer moved to it, where it already is.
    function activate(index, { pointer = false, reveal = !pointer } = {}) {
        if (options[index]?.disabled) return;
        const changed = index !== active;
        active = index;
        pointed = pointer;
        paint();
        if (reveal) options[active]?.element.scrollIntoView({ block: 'nearest' });
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
export { listbox };
