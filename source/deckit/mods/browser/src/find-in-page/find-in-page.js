// Find in the page of the tab in front, in a panel floating at the top right of `area`, over the page. Closing it gives
// the page the keyboard back.
function findInPage({ ui, area, frontTab }) {
    let searchedTab = null;
    let state = { query: '', caseSensitive: false };

    ui.addStyle(`
        .browser-find {
            display: flex;
            align-items: center;
            gap: 2px;
            padding: 4px;
            right: 12px;
            border-radius: var(--deckit-radius-round);
            transform-origin: top right;
        }
        .browser-find-field { flex: 0 1 auto; width: 300px; min-width: 0; margin: 0 2px; }
    `);
    const panel = ui.floatingPanel();
    const { element } = panel;
    element.classList.add('browser-find');
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
        panel.focus(field);
        if (state.query) step(false);
    }

    function close() {
        hide({ keepSelection: true });
        frontTab().page?.focus();
    }

    function hide({ keepSelection = false } = {}) {
        if (!panel.isOpen()) return;
        panel.hide();
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
