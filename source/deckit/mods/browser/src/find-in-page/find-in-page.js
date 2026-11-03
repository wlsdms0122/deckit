// Find in the page of the tab in front, in a bar at the top right of `area`, on a layer over the page and its web
// pages: it stays while the person uses the page, fading in as it shows and out as it hides. Closing it gives the page
// the keyboard back.
function findInPage({ theme, ui, area, frontTab }) {
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
            border: var(--deckit-border);
            background: var(--deckit-background);
            box-shadow: var(--deckit-shadow-raised);
            color: var(--deckit-text);
            transform-origin: top right;
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
        onCancel: close,
    });
    const closeButton = ui.iconButton({
        icon: ui.icon('x', { size: 14 }),
        title: 'Close',
        onClick: close,
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
        } else if (!layer) {
            layer = ui.layer(element);
            element.animate(FADE, { duration: theme.motion.fast, easing: theme.motion.easing });
        }
        layer.focus(field);
        if (state.query) step(false);
    }

    function close() {
        hide();
        frontTab().page?.focus();
    }

    // Hidden, it takes no presses while it fades, and the match it selected is let go.
    function hide() {
        if (!layer || leaving) return;
        element.style.pointerEvents = 'none';
        leaving = element.animate(FADE, {
            duration: theme.motion.fast,
            easing: theme.motion.easing,
            direction: 'reverse',
            fill: 'forwards',
        });
        leaving.onfinish = () => {
            leaving.cancel();
            leaving = null;
            element.style.pointerEvents = '';
            layer.remove();
            layer = null;
        };
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

const FADE = [
    { opacity: 0, transform: 'translateY(-6px) scale(.96)' },
    { opacity: 1, transform: 'none' },
];

module.exports = { findInPage };
