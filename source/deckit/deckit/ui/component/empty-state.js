DeckitModule.define('deckit/ui/component/empty-state', { uses: [], provides: ['STYLE', 'make'] }, () => {
    // MARK: - Property
    const STYLE = `
        .deckit-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            flex: 1 1 auto;
            min-height: 0;
            box-sizing: border-box;
            padding: 24px 30px;
            text-align: center;
            color: var(--deckit-text);
        }
        .deckit-empty-icon { display: flex; opacity: 0.25; }
        .deckit-empty-title { font: 700 var(--deckit-type-heading); }
        .deckit-empty-hint { max-width: 460px; margin-top: -4px; opacity: 0.5; font: var(--deckit-type-body); line-height: 1.6; }
        .deckit-empty-actions { display: flex; gap: 8px; margin-top: 4px; }
        .deckit-empty-hint:empty, .deckit-empty-actions:empty { display: none; }
    `;

    // MARK: - Initializer
    // MARK: - Public
    function make() {
        return { emptyState };
    }

    // MARK: - Private
    // What a place shows with nothing in it: an icon, a title, a hint and what to do about it.
    function emptyState({ icon = '', title = '', hint = '', actions = [] } = {}) {
        const box = element('div', 'deckit-empty');
        if (icon) {
            const mark = element('div', 'deckit-empty-icon');
            mark.innerHTML = icon;
            box.append(mark);
        }
        const heading = element('div', 'deckit-empty-title');
        const note = element('div', 'deckit-empty-hint');
        const row = element('div', 'deckit-empty-actions');
        box.append(heading, note, row);
        box.setTitle = (text) => {
            heading.textContent = text;
        };
        box.setHint = (text) => {
            note.textContent = text;
        };
        box.setActions = (list) => row.replaceChildren(...list);
        box.setTitle(title);
        box.setHint(hint);
        box.setActions(actions);
        return box;
    }

    function element(tag, className) {
        const made = document.createElement(tag);
        made.className = className;
        return made;
    }

    return { STYLE, make };
});
