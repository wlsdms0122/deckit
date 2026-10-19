// Go to Line: a line of the view's file typed, or `line:column`, with where Enter goes said under it. A line past the
// last is the last, and a column past the line's end is its end.
function goToLine({ ui, scrollEffect }) {
    const TYPED = /^\s*(\d+)\s*(?::\s*(\d+)\s*)?$/;

    return { show };

    function show(view) {
        const picker = ui.quickPick({
            placeholder: 'Go to Line',
            key: () => '',
            create: () => null,
            onInput: draw,
            onEnter: ({ text }) => go(text),
        });
        draw(picker.text());

        function draw(text) {
            const target = targetOf(text);
            picker.set([], {
                message: !text.trim()
                    ? `At ${placeOf(view.state.selection.main.head)}. Type a line between 1 and ${view.state.doc.lines}.`
                    : target
                      ? `Go to ${placeOf(target)}.`
                      : 'Type a line, or line:column.',
                alert: !!text.trim() && !target,
            });
        }

        function go(text) {
            const target = targetOf(text);
            if (!target) return draw(text);
            picker.close();
            view.dispatch({ selection: { anchor: target } });
            view.dispatch({ effects: scrollEffect(view, view.state.selection.main) });
            view.focus();
        }

        // The position typed, or null when what is typed is no place.
        function targetOf(text) {
            const typed = TYPED.exec(text);
            if (!typed) return null;
            const { doc } = view.state;
            const line = doc.line(Math.min(Math.max(1, Number(typed[1])), doc.lines));
            const column = typed[2] ? Math.max(1, Number(typed[2])) : 1;
            return Math.min(line.from + column - 1, line.to);
        }

        function placeOf(position) {
            const line = view.state.doc.lineAt(position);
            return `line ${line.number}, column ${position - line.from + 1}`;
        }
    }
}

module.exports = { goToLine };
