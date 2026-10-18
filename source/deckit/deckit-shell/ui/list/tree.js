// MARK: - Property
// Letters typed this soon after the one before are one name to find, and a Space among them is one of its letters.
const TYPE_AHEAD_MS = 800;

// MARK: - Initializer
// MARK: - Public
// The keys of a list or a tree of items, which takes the focus. Its owner keeps the selection and is told where the
// keys move it: `items()` are the keys of the items the arrows move among, in order, and `lead()` the one they move
// from, or null. A list is a tree whose items do not nest. Keys typed into something inside it (a rename) are its own.
function tree(
    element,
    {
        items,
        lead,
        nameOf,
        multiple = false,
        expanded = () => null,
        parentOf = () => null,
        childrenOf = () => [],
        onSelect,
        onSelectAll = () => {},
        onToggle = () => {},
        onPreview = null,
        onRename = null,
        onOpen = null,
    }
) {
    let typed = '';
    let typedAt = 0;
    const onKey = (event) => {
        if (event.target !== element || event.ctrlKey) return;
        if (take(event)) event.preventDefault();
    };
    const tabIndexBefore = element.getAttribute('tabindex');
    element.tabIndex = 0;
    element.addEventListener('keydown', onKey);
    return () => {
        element.removeEventListener('keydown', onKey);
        if (tabIndexBefore === null) element.removeAttribute('tabindex');
        else element.setAttribute('tabindex', tabIndexBefore);
    };

    // Whether the key was the tree's.
    function take(event) {
        const { key, code, metaKey, altKey, shiftKey } = event;
        const current = lead();
        if (metaKey) {
            if (altKey || shiftKey) return false;
            if (key === 'ArrowDown' || code === 'KeyO') return act(onOpen, current);
            if (code === 'KeyA' && multiple) {
                onSelectAll();
                return true;
            }
            return false;
        }
        const keys = items();
        const index = keys.indexOf(current);
        const extend = multiple && shiftKey && index >= 0;
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            const by = key === 'ArrowDown' ? 1 : -1;
            // Option takes an arrow to the end it points at.
            if (altKey) return move(by > 0 ? keys.at(-1) : keys[0], current, extend);
            return move(
                index < 0 ? keys[0] : keys[Math.max(0, Math.min(keys.length - 1, index + by))],
                current,
                extend
            );
        }
        if (altKey) return false;
        if (key === 'Home' || key === 'End') return move(key === 'Home' ? keys[0] : keys.at(-1), current, extend);
        if (key === 'ArrowRight' && current != null) {
            if (expanded(current) === false) onToggle(current, true);
            else enter(current);
            return true;
        }
        if (key === 'ArrowLeft' && current != null) {
            if (expanded(current) === true) onToggle(current, false);
            else goUp(current);
            return true;
        }
        if (key === ' ' && Date.now() - typedAt > TYPE_AHEAD_MS) return act(onPreview, current);
        if (key === 'Enter') return act(onRename, current);
        if (key.length === 1) return typeAhead(key, keys, current);
        return false;
    }

    function move(next, current, extend) {
        if (next != null && next !== current) onSelect(next, { extend });
        return true;
    }

    function act(callback, current) {
        if (!callback || current == null) return false;
        callback(current);
        return true;
    }

    function goUp(current) {
        const parent = parentOf(current);
        if (parent != null) onSelect(parent, { extend: false });
    }

    // The first child, once the item shows them; what the owner reads to answer may take a while.
    async function enter(current) {
        const children = await childrenOf(current);
        if (children.length && lead() === current) onSelect(children[0], { extend: false });
    }

    // The first item whose name starts with what was typed.
    function typeAhead(letter, keys, current) {
        const now = Date.now();
        typed = (now - typedAt > TYPE_AHEAD_MS ? '' : typed) + letter.toLowerCase();
        typedAt = now;
        const match = keys.find((key) => nameOf(key).toLowerCase().startsWith(typed));
        if (match != null && match !== current) onSelect(match, { extend: false });
        return true;
    }
}

// MARK: - Private
export { tree };
