// Find in the page of the tab in front, in a bar at the top right of `area`, on a layer over the page and its web
// pages: it stays while the person uses the page. A key shows it, and it is there at once; its close button puts it
// away by the kit's `go`, fading as it rises towards its edge, and Escape at once. Closing it gives the page the
// keyboard back.
function findInPage({ ui, area, frontTab }) {
    let searchedTab = null;
    let state = { query: '', caseSensitive: false };

    ui.addStyle(`
        .browser-find {
            position: fixed;
            right: 12px;
            display: flex;
            align-items: center;
            gap: 2px;
            padding: 4px;
            box-sizing: border-box;
            border-radius: var(--deckit-radius-round);
            background: var(--deckit-elevated);
            box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
            color: var(--deckit-text);
        }
        .browser-find-field { flex: 0 1 auto; width: 300px; min-width: 0; margin: 0 2px; }
        .browser-find .deckit-icon-button,
        .browser-find .deckit-toggle-button { border-radius: var(--deckit-radius-round); }
    `);
    const element = document.createElement('div');
    element.className = 'browser-find';
    let layer = null;
    let leaving = null; // the exit playing, once it hides
    const field = ui.findBar({
        placeholder: 'Find in page',
        options: ['caseSensitive'],
        nav: true,
        onChange: change,
        onNext: () => step(false),
        onPrevious: () => step(true),
        // Escape, a key, puts it away at once.
        onCancel: () => close({ still: true }),
    });
    const closeButton = ui.iconButton({
        icon: ui.icon('x', { size: 14 }),
        title: 'Close',
        onClick: () => close(),
        size: 'small',
    });
    field.element.classList.add('browser-find-field');
    element.append(field.element, closeButton.element);

    return { show, hide, showCount, release };

    function show() {
        element.style.top = area.getBoundingClientRect().top + 8 + 'px';
        if (leaving) {
            leaving.cancel();
            leaving = null;
            element.style.pointerEvents = '';
        } else if (!layer) layer = ui.layer(element);
        layer.focus(field);
        if (state.query) step(false);
    }

    function close({ still = false } = {}) {
        hide({ still });
        frontTab().page?.focus();
    }

    // Hidden, it takes no presses and lets go of the keyboard while it fades, or with `still` is gone at once, and the
    // match it selected is let go.
    function hide({ still = false } = {}) {
        if (!layer || leaving) return;
        element.style.pointerEvents = 'none';
        if (element.contains(element.ownerDocument.activeElement)) element.ownerDocument.activeElement.blur();
        const gone = () => {
            leaving?.cancel();
            leaving = null;
            element.style.pointerEvents = '';
            layer.remove();
            layer = null;
        };
        if (still) gone();
        else {
            const going = (leaving = ui.motion.go(element, { y: -RISE }));
            going.finished.then(() => leaving === going && gone());
        }
        searchedTab?.page.stopFind();
        searchedTab = null;
        field.setCount(0, 0);
    }

    function showCount(tab, result) {
        if (searchedTab === tab) field.setCount(result.active, result.matches);
    }

    // The page of `tab` is gone.
    function release(tab) {
        if (searchedTab === tab) hide();
    }

    function change(next) {
        state = next;
        const tab = frontTab();
        if (!state.query) {
            tab.page.stopFind();
            searchedTab = null;
            field.setCount(0, 0);
            return;
        }
        tab.page.find(state.query, { start: true, matchCase: state.caseSensitive });
        searchedTab = tab;
    }

    function step(back) {
        if (!state.query) return;
        const tab = frontTab();
        tab.page.find(state.query, { back, start: searchedTab !== tab, matchCase: state.caseSensitive });
        searchedTab = tab;
    }
}

// How far the bar rises towards its edge as it goes.
const RISE = 4;

module.exports = { findInPage };
