// Find in the page of the tab in front, in a bar floating over the top of the page.
function findInPage({ theme, ui, frontTab }) {
    let searchedTab = null;
    let state = { query: '', caseSensitive: false };
    // Apart from the style, which mid-fade still says open while the bar is already invisible.
    let open = false;
    let hiding = null;

    ui.addStyle(`
        .browser-find {
            z-index: 3;
            top: 8px;
            right: 10px;
            display: none;
            align-items: center;
            gap: 2px;
            padding: 0 4px 0 2px;
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
            transition:
                opacity var(--deckit-fast) var(--deckit-easing),
                transform var(--deckit-fast) var(--deckit-easing);
        }
        .browser-find[data-left] { right: auto; left: calc(10px + var(--deckit-title-bar-area-x, 0px)); }
        .browser-find[data-open] { opacity: 1; transform: none; }
        .browser-find-field { flex: 0 0 auto; width: 330px; margin: 0 2px; }
    `);
    const element = ui.element('div', { className: 'browser-floating browser-find' });
    const field = ui.findBar({
        placeholder: 'Find in page',
        options: ['caseSensitive'],
        nav: true,
        onChange: change,
        onNext: () => step(false),
        onPrevious: () => step(true),
        onCancel: () => hide({ keepSelection: true }),
    });
    const close = ui.iconButton({
        icon: ui.icon('x', { size: 14 }),
        title: 'Close',
        onClick: () => hide({ keepSelection: true }),
        size: 'small',
    });
    field.element.classList.add('browser-find-field');
    element.append(field.element, close.element);

    return { element, show, hide, showCount, release };

    // `left` puts the bar in the top left corner, else it is in the top right.
    function show({ left }) {
        element.toggleAttribute('data-left', left);
        if (!open) {
            open = true;
            clearTimeout(hiding);
            element.style.display = 'flex';
            // Laid out at the start position first, or there is nothing to animate.
            void element.offsetWidth;
            element.toggleAttribute('data-open', true);
        }
        field.focus();
        if (state.query) step(false);
    }

    function hide({ keepSelection = false } = {}) {
        if (!open) return;
        open = false;
        element.removeAttribute('data-open');
        clearTimeout(hiding);
        hiding = setTimeout(() => (element.style.display = ''), theme.motion.fast);
        searchedTab?.page.stopFind({ keepSelection });
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

module.exports = { findInPage };
