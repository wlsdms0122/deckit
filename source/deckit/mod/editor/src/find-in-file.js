// Find and replace in the open file: the kit's find bar as the engine's search panel.
function findInFile({ engine, ui }) {
    const COUNT_LIMIT = 10000;
    const COUNT_DELAY_MS = 90;
    const bars = new WeakMap(); // engine view -> its find bar

    return { createPanel, open };

    // Opened with the replace line for ⌥⌘F.
    function open(view, { replace = false } = {}) {
        engine.openSearchPanel(view);
        const bar = bars.get(view);
        if (replace) bar.setReplaceOpen(true);
        else bar.focus();
    }

    // Counted once typing pauses, so the key that changed the query reaches the screen first. Which match is a binary
    // search over those found, so stepping is answered at once.
    function createPanel(view) {
        let matches = null; // for the query and text they were found in
        let countTimer = null;
        const dom = ui.element('div', { style: { padding: '6px 10px' } });
        const bar = ui.findBar({
            placeholder: 'Find in file',
            nav: true,
            replace: {
                onReplace: () => {
                    withReplacement();
                    engine.replaceNext(view);
                },
                onReplaceAll: () => {
                    withReplacement();
                    engine.replaceAll(view);
                },
            },
            onChange: apply,
            onNext: () => engine.findNext(view),
            onPrevious: () => engine.findPrevious(view),
            onCancel: () => {
                engine.closeSearchPanel(view);
                view.focus();
            },
        });
        dom.append(bar.element);
        bars.set(view, bar);

        return {
            dom,
            top: true,
            mount() {
                const query = engine.getSearchQuery(view.state);
                bar.setQuery(query.search, {
                    caseSensitive: query.caseSensitive,
                    word: query.wholeWord,
                    regex: query.regexp,
                });
                bar.focus();
                count();
            },
            update(update) {
                const queried = update.transactions.some((transaction) =>
                    transaction.effects.some((effect) => effect.is(engine.setSearchQuery))
                );
                if (update.docChanged || queried) countSoon();
                else if (update.selectionSet && !countTimer) place();
            },
            destroy() {
                clearTimeout(countTimer);
            },
        };

        function apply(state) {
            view.dispatch({
                effects: engine.setSearchQuery.of(
                    new engine.SearchQuery({
                        search: state.query,
                        caseSensitive: state.caseSensitive,
                        wholeWord: state.word,
                        regexp: state.regex,
                        replace: bar.replacement(),
                    })
                ),
            });
        }

        // The replacement is read when it is used, so the query carries it only then.
        function withReplacement() {
            apply(bar.state());
        }

        function countSoon() {
            clearTimeout(countTimer);
            countTimer = setTimeout(count, COUNT_DELAY_MS);
        }

        function count() {
            countTimer = null;
            const query = engine.getSearchQuery(view.state);
            if (!query.search || !query.valid) {
                matches = null;
                return bar.setCount(0, 0);
            }
            const from = [];
            const to = [];
            const cursor = query.getCursor(view.state);
            for (let result = cursor.next(); !result.done && from.length < COUNT_LIMIT; result = cursor.next()) {
                from.push(result.value.from);
                to.push(result.value.to);
            }
            matches = { from, to };
            place();
        }

        function place() {
            if (!matches) return;
            const selection = view.state.selection.main;
            let low = 0;
            let high = matches.from.length - 1;
            let at = 0;
            while (low <= high) {
                const middle = (low + high) >> 1;
                if (matches.from[middle] < selection.from) low = middle + 1;
                else if (matches.from[middle] > selection.from) high = middle - 1;
                else {
                    if (matches.to[middle] === selection.to) at = middle + 1;
                    break;
                }
            }
            bar.setCount(at, matches.from.length);
        }
    }
}

module.exports = { findInFile };
