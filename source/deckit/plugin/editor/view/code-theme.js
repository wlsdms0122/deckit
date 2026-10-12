// The engine's look in the kit's theme. The colour highlighter names each token by its colour, for the minimap to
// paint.
function codeTheme({ engine, theme, ui }) {
    const { tags } = engine;
    const { syntax } = theme;
    const fast = (property) => `${property} ${theme.motion.fast}ms ${theme.motion.easing}`;
    const highlights = [
        {
            tag: [
                tags.keyword,
                tags.controlKeyword,
                tags.moduleKeyword,
                tags.operatorKeyword,
                tags.definitionKeyword,
                tags.modifier,
            ],
            color: syntax.keyword,
        },
        { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character], color: syntax.string },
        { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit], color: syntax.number },
        {
            tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
            color: syntax.comment,
            fontStyle: 'italic',
        },
        {
            tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName],
            color: syntax.function,
        },
        { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.typeName)], color: syntax.type },
        { tag: [tags.propertyName, tags.attributeName, tags.labelName], color: syntax.property },
        { tag: [tags.operator, tags.derefOperator, tags.escape], color: syntax.operator },
        { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: syntax.meta },
        { tag: [tags.tagName, tags.heading], color: syntax.property, fontWeight: '600' },
        { tag: [tags.link, tags.url], color: syntax.function, textDecoration: 'underline' },
        { tag: tags.emphasis, fontStyle: 'italic' },
        { tag: tags.strong, fontWeight: '700' },
        { tag: tags.invalid, color: syntax.invalid },
    ];
    const colorHighlighter = engine.tagHighlighter(
        highlights.filter((highlight) => highlight.color).map(({ tag, color }) => ({ tag, class: color }))
    );
    const editorTheme = engine.EditorView.theme(
        {
            '&': { height: '100%', color: theme.color.text, backgroundColor: 'transparent' },
            '&.cm-focused': { outline: 'none' },
            '.cm-content': { caretColor: theme.color.accent, padding: '8px 0' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: theme.color.accent, borderLeftWidth: '2px' },
            '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
                { backgroundColor: ui.alpha(theme.color.accent, 0.28) },
            // Transparent: lines scrolled sideways are clipped at its edge (clipGutter in view/code-view.js).
            '.cm-gutters': { backgroundColor: 'transparent', color: theme.color.muted, border: '0' },
            '.cm-activeLineGutter': { backgroundColor: 'transparent', color: theme.color.text },
            '.cm-activeLine': { backgroundColor: theme.color.surface },
            // The engine draws a partial-line selection at letter height and this band at line height, so the two never
            // meet; the band steps aside while text is selected.
            '&.editor-selecting .cm-activeLine, &.editor-selecting .cm-activeLineGutter': {
                backgroundColor: 'transparent',
            },
            '.cm-matchingBracket': { backgroundColor: ui.alpha(theme.color.accent, 0.22), outline: 'none' },
            '.cm-selectionMatch': { backgroundColor: theme.color.selected },
            '.cm-searchMatch': { backgroundColor: ui.alpha(theme.color.warn, 0.35), outline: 'none' },
            '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: ui.alpha(theme.color.warn, 0.7) },
            '.cm-foldGutter .cm-gutterElement': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px 0 2px',
            },
            // Muted by colour: an opacity would fade the hover square with the glyph.
            '.cm-foldGutter .editor-fold-open, .cm-foldGutter .editor-fold-closed': {
                cursor: 'pointer',
                color: theme.color.muted,
                transition: `${fast('background-color')}, ${fast('color')}`,
            },
            '.cm-foldGutter .editor-fold-closed': { color: theme.color.text },
            '.cm-foldGutter .editor-fold-open:hover, .cm-foldGutter .editor-fold-closed:hover': {
                color: theme.color.text,
                backgroundColor: theme.color.hover,
            },
            '.cm-foldPlaceholder': {
                backgroundColor: theme.color.selected,
                border: '0',
                borderRadius: '5px',
                color: 'inherit',
                padding: '0 6px',
                margin: '0 3px',
                cursor: 'pointer',
                transition: fast('background-color'),
            },
            '.cm-foldPlaceholder:hover': { backgroundColor: theme.color.pressed },
            '.cm-panels': { backgroundColor: theme.color.surface, color: theme.color.text },
            '.cm-panels.cm-panels-top': { borderBottom: theme.border },
            '.cm-tooltip': { backgroundColor: theme.color.background, border: theme.border, color: theme.color.text },
        },
        { dark: theme.dark }
    );

    return {
        extensions: [editorTheme, engine.syntaxHighlighting(engine.HighlightStyle.define(highlights))],
        colorHighlighter,
    };
}
