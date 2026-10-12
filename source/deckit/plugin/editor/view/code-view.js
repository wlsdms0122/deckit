// The engine's view of an open file, with the editor's extensions, in a box laid over the others. The settings it reads
// are the font, its size and line wrapping.
function codeView({ engine, theme, ui, settings, look, separatorExtension, createFindPanel, onUpdate }) {
    // The engine's special characters, less "\r" (kept by CRLF lines in a mixed file, see separatorFor in view/disk.js)
    // and the byte order mark.
    const QUIET_SPECIAL_CHARACTERS =
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u2028\u2029\u202d\u202e\u2066\u2067\u2069\ufff9-\ufffc]/g;
    // Far past any box, for a clip that only cuts on one side.
    const FAR = 1e6;

    const wrapping = new engine.Compartment();
    const typeface = new engine.Compartment();
    // A compartment, so a file renamed to another type is coloured as that type.
    const language = new engine.Compartment();

    return { create, applySetting, setLanguage, scrollEffect };

    // A box of its own: the engine insists its element is position: relative, so it cannot be laid over the others.
    function create(text, path, { inset }) {
        const box = ui.element('div', {
            style: { position: 'absolute', inset: '0', right: inset, visibility: 'hidden' },
        });
        const view = new engine.EditorView({ state: stateOf(text, path), parent: box });
        // Sideways wheel scrolling is done here so the scroll and the gutter clip land in the same frame; left to the
        // browser, the clip lags a frame and the edge of the code wobbles.
        view.scrollDOM.addEventListener(
            'wheel',
            (event) => {
                if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
                event.preventDefault();
                view.scrollDOM.scrollLeft += event.deltaX;
                clipGutter(view);
            },
            { passive: false }
        );
        view.scrollDOM.addEventListener('scroll', () => clipGutter(view), { passive: true });
        return { box, view };
    }

    function applySetting(view, key, value) {
        if (key === 'wrap')
            view.dispatch({ effects: wrapping.reconfigure(value ? engine.EditorView.lineWrapping : []) });
        else if (key === 'fontSize' || key === 'font') view.dispatch({ effects: typeface.reconfigure(typefaceNow()) });
        clipGutter(view);
    }

    function setLanguage(view, path) {
        view.dispatch({ effects: language.reconfigure(languageOf(path)) });
    }

    // Centred, unless all of it is in sight already, where moving the text only loses the place.
    function scrollEffect(view, range) {
        const box = view.scrollDOM.getBoundingClientRect();
        const top = view.coordsAtPos(range.from);
        const bottom = view.coordsAtPos(range.to);
        const inSight = !!top && !!bottom && top.top >= box.top && bottom.bottom <= box.bottom;
        return engine.EditorView.scrollIntoView(range, { y: inSight ? 'nearest' : 'center' });
    }

    function stateOf(text, path) {
        return engine.EditorState.create({
            doc: text,
            extensions: [
                engine.lineNumbers(),
                engine.highlightActiveLineGutter(),
                engine.highlightSpecialChars({ specialChars: QUIET_SPECIAL_CHARACTERS }),
                engine.history(),
                engine.codeFolding({ placeholderDOM: foldPlaceholder }),
                engine.foldGutter({ markerDOM: foldMarker }),
                engine.drawSelection(),
                engine.dropCursor(),
                engine.EditorState.allowMultipleSelections.of(true),
                engine.indentOnInput(),
                engine.bracketMatching(),
                engine.closeBrackets(),
                engine.rectangularSelection(),
                engine.crosshairCursor(),
                engine.highlightActiveLine(),
                engine.highlightSelectionMatches(),
                engine.search({
                    top: true,
                    createPanel: createFindPanel,
                    scrollToMatch: (range, view) => scrollEffect(view, range),
                }),
                engine.keymap.of([
                    ...engine.closeBracketsKeymap,
                    ...engine.defaultKeymap,
                    ...engine.searchKeymap,
                    ...engine.historyKeymap,
                    ...engine.foldKeymap,
                    engine.indentWithTab,
                ]),
                separatorExtension(text),
                language.of(languageOf(path)),
                look,
                wrapping.of(settings.get('wrap') ? engine.EditorView.lineWrapping : []),
                typeface.of(typefaceNow()),
                engine.EditorView.updateListener.of((update) => {
                    if (update.selectionSet)
                        update.view.dom.classList.toggle(
                            'editor-selecting',
                            update.state.selection.ranges.some((range) => !range.empty)
                        );
                    onUpdate(update);
                }),
            ],
        });
    }

    function languageOf(path) {
        const mode = engine.languages[fileTypeOf(path)?.mode];
        return mode ? mode() : [];
    }

    function typefaceNow() {
        return typefaceOf(engine, { size: settings.get('fontSize'), font: settings.get('font'), mono: theme.mono });
    }

    // Lines scrolled sideways are clipped where the gutter begins, so the gutter can stay transparent. The selection and
    // cursor layers start at the gutter's left edge, so theirs are clipped a gutter's width further in. The layers are
    // zero-size boxes with their marks outside, so an inset clips them whole; a polygon reaching far past the box clips
    // only what is left of the gutter's edge.
    function clipGutter(view) {
        const left = view.scrollDOM.scrollLeft;
        const gutter = view.dom.querySelector('.cm-gutters')?.offsetWidth || 0;
        const edge = left + gutter;
        view.contentDOM.style.clipPath = left ? `inset(0 0 0 ${left}px)` : '';
        for (const layer of view.dom.querySelectorAll('.cm-layer'))
            layer.style.clipPath = left
                ? `polygon(${edge}px -${FAR}px, ${FAR}px -${FAR}px, ${FAR}px ${FAR}px, ${edge}px ${FAR}px)`
                : '';
    }

    // The engine's own marker is a text glyph a few pixels wide at any font size.
    function foldMarker(open) {
        const marker = ui.element('span', {
            className: open ? 'editor-fold-open' : 'editor-fold-closed',
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '5px',
            },
        });
        marker.title = open ? 'Fold' : 'Unfold';
        marker.innerHTML = ui.icon(open ? 'chevronDown' : 'chevronRight', { size: 13 });
        return marker;
    }

    // The "…" character sets its dots almost touching, which reads as a smudge at code sizes.
    function foldPlaceholder(view, onClick) {
        const chip = ui.element('span', {
            className: 'cm-foldPlaceholder',
            style: { display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', height: '16px' },
        });
        chip.title = 'Unfold';
        chip.innerHTML = ui.icon('ellipsis', { size: 16 });
        chip.onclick = onClick;
        return chip;
    }
}
