// Find in the page of the active tab, in a bar floating over the top of the page.
function findInPage({ theme, ui, activeTab }) {
    let finding = null; // the tab a find runs on
    let state = { query: '', caseSensitive: false };
    // Apart from the style, which mid-fade still says open while the bar is already invisible.
    let open = false;
    let hiding = null;

    ui.addStyle(`
        .browser-find {
            position: absolute;
            z-index: 3;
            top: calc(8px + var(--deckit-top-inset, 0px));
            right: 10px;
            display: none;
            align-items: center;
            gap: 2px;
            box-sizing: border-box;
            height: 36px;
            padding: 0 4px 0 2px;
            border: var(--deckit-border);
            border-radius: var(--deckit-radius-round);
            background: color-mix(in srgb, var(--deckit-background) 94%, transparent);
            backdrop-filter: blur(12px) saturate(1.4);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.26);
            color: var(--deckit-text);
            font: var(--deckit-type-body);
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
            transition:
                opacity var(--deckit-fast) var(--deckit-easing),
                transform var(--deckit-fast) var(--deckit-easing);
        }
        .browser-find[data-left] { right: auto; left: 10px; }
        .browser-find[data-open] { opacity: 1; transform: none; }
        .browser-find .deckit-find { flex: 0 0 auto; width: 330px; margin: 0 2px; }
    `);
    const element = ui.element('div', { className: 'browser-find' });
    const field = ui.findBar({
        placeholder: 'Find in page',
        options: ['case'],
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
        finding?.page.stopFind({ keepSelection });
        finding = null;
        field.setCount(0, 0);
    }

    function showCount(tab, result) {
        if (finding === tab) field.setCount(result.active, result.matches);
    }

    // The page of `tab` is gone.
    function release(tab) {
        if (finding === tab) hide();
    }

    function change(next) {
        state = next;
        const tab = activeTab();
        if (!state.query) {
            tab.page.stopFind();
            finding = null;
            field.setCount(0, 0);
            return;
        }
        tab.page.find(state.query, { start: true, matchCase: state.caseSensitive });
        finding = tab;
    }

    function step(back) {
        if (!state.query) return;
        const tab = activeTab();
        tab.page.find(state.query, { back, start: finding !== tab, matchCase: state.caseSensitive });
        finding = tab;
    }
}
