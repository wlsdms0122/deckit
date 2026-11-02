// Find in the page of the tab in front, in a bar between the toolbar and the page: nothing is drawn over a web page.
function findInPage({ ui, frontTab }) {
    let searchedTab = null;
    let state = { query: '', caseSensitive: false };
    let open = false;

    ui.addStyle(`
        .browser-find {
            flex: 0 0 auto;
            display: none;
            align-items: center;
            justify-content: flex-end;
            gap: 2px;
            padding: 0 10px 6px;
        }
        .browser-find[data-open] { display: flex; }
        .browser-find-field { flex: 0 1 auto; width: 330px; min-width: 0; margin: 0 2px; }
    `);
    const element = ui.element('div', { className: 'browser-find' });
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

    function show() {
        open = true;
        element.toggleAttribute('data-open', true);
        field.focus();
        if (state.query) step(false);
    }

    function hide({ keepSelection = false } = {}) {
        if (!open) return;
        open = false;
        element.removeAttribute('data-open');
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
