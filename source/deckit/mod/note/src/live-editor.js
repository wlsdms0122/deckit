const NoteEngine = require('./engine.js');
const { localDate } = require('./format.js');
const {
    HEADING_SHAPES,
    CHECKLIST_SHAPES,
    NUMBERED_LIST_SHAPES,
    QUOTE_SHAPES,
    CODE_SHAPES,
    DIVIDER_SHAPES,
    BOLD_SHAPES,
    ITALIC_SHAPES,
    STRIKETHROUGH_SHAPES,
    CHECK_SHAPES,
} = require('./icons.js');
const { isAddress, linkTargetOf, linkDestinationOf } = require('./link.js');
const { PARAGRAPH_STYLES } = require('./paragraph-style.js');

// The document is the file's text exactly; formatting is only decorations drawn over it.
function liveEditor({ theme, ui, match, typeface, chordOf, clipboard, onChange, onFollowLink }) {
    // Only for replacing the mark at a line start. What style a line is in comes from the syntax tree (lineStyleAt).
    const LEADING_MARK = /^(\s*)(#{1,6}\s+|(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;
    const QUOTE_MARKS = /^(\s*>\s?)+/;
    const ICON_SIZE = 15;
    const engine = NoteEngine;
    const tags = engine.tags;
    const muted = theme.color.muted;
    const syntax = theme.syntax;
    const linkColor = ui.mix(theme.color.accent, theme.color.text, 0.85);
    // Translucent, so the panel's glass shows through.
    const codeBackground = ui.alpha(theme.color.text, 0.07);
    // Drawn as a background image, which needs the svg namespace that ui.iconOf markup leaves out.
    const tick = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${theme.color.onAccent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${CHECK_SHAPES}</svg>`
    );
    const highlight = engine.HighlightStyle.define([
        { tag: tags.heading1, fontSize: '1.6em', fontWeight: '800', letterSpacing: '-.01em' },
        { tag: tags.heading2, fontSize: '1.3em', fontWeight: '700' },
        { tag: tags.heading3, fontSize: '1.12em', fontWeight: '700' },
        { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '700' },
        { tag: tags.strong, fontWeight: '700' },
        { tag: tags.emphasis, fontStyle: 'italic' },
        { tag: tags.strikethrough, textDecoration: 'line-through' },
        { tag: tags.link, color: linkColor },
        { tag: tags.url, color: muted },
        { tag: tags.monospace, fontFamily: theme.mono, fontSize: '.9em' },
        { tag: [tags.processingInstruction, tags.contentSeparator, tags.labelName], color: muted },
        { tag: tags.quote, color: ui.mix(theme.color.text, theme.color.background, 0.78) },
        // Fenced code in the languages the engine carries.
        { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.modifier], color: syntax.keyword },
        { tag: [tags.string, tags.regexp], color: syntax.string },
        { tag: [tags.number, tags.bool, tags.null], color: syntax.number },
        { tag: [tags.comment, tags.lineComment, tags.blockComment], color: syntax.comment, fontStyle: 'italic' },
        { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: syntax.function },
        { tag: [tags.typeName, tags.className], color: syntax.type },
        { tag: tags.propertyName, color: syntax.property },
    ]);
    const editorTheme = engine.EditorView.theme(
        {
            '&': { height: '100%', color: theme.color.text, backgroundColor: 'transparent' },
            '&.cm-focused': { outline: 'none' },
            // The font face is set only by typefaceTheme, so two rules never race. The side margin is on the scroller:
            // the engine paints a selected line from the content's outer edge, so a margin inside it would be painted.
            '.cm-scroller': { lineHeight: '1.6', overflowX: 'hidden', padding: '0 28px' },
            '.cm-content': {
                padding: '4px 0 40vh',
                caretColor: theme.color.accent,
                width: '100%',
                boxSizing: 'border-box',
            },
            '.cm-line': { padding: '0' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: theme.color.accent, borderLeftWidth: '2px' },
            '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
                { backgroundColor: ui.alpha(theme.color.accent, 0.28) },
            '.cm-placeholder': { color: muted },
            '.note-h1': { paddingTop: '.35em !important' },
            '.note-h2': { paddingTop: '.5em !important' },
            '.note-h3': { paddingTop: '.35em !important' },
            '.note-quote': { borderLeft: `3px solid ${theme.color.divider}`, paddingLeft: '.85em !important' },
            '.note-code': {
                fontFamily: theme.mono,
                fontSize: '.9em',
                backgroundColor: codeBackground,
                padding: '0 .8em !important',
            },
            '.note-code-first': {
                borderTopLeftRadius: '7px',
                borderTopRightRadius: '7px',
                paddingTop: '.3em !important',
            },
            '.note-code-last': {
                borderBottomLeftRadius: '7px',
                borderBottomRightRadius: '7px',
                paddingBottom: '.3em !important',
            },
            '.note-fence': { color: muted, fontSize: '.8em' },
            '.note-fence-folded': { color: muted, fontSize: '.7em', lineHeight: '1.1', textAlign: 'right' },
            '.note-inline-code': {
                backgroundColor: ui.alpha(theme.color.text, 0.1),
                borderRadius: '4px',
                padding: '.05em .25em',
            },
            '.note-link': {
                color: linkColor,
                textDecoration: 'underline',
                textDecorationColor: ui.alpha(theme.color.accent, 0.45),
                textUnderlineOffset: '2px',
                cursor: 'pointer',
            },
            '.note-done': { color: muted },
            '.note-rule': {
                borderBottom: `1px solid ${theme.color.divider}`,
                lineHeight: '.8 !important',
                marginBottom: '.6em',
            },
            '.note-bullet': { display: 'inline-block', width: '1.1em', color: muted, textAlign: 'left' },
            '.note-check': {
                display: 'inline-block',
                verticalAlign: '-.15em',
                width: '1.05em',
                height: '1.05em',
                marginRight: '.45em',
                boxSizing: 'border-box',
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 1.5px ${muted}`,
                cursor: 'pointer',
            },
            ".note-check[aria-checked='true']": {
                background: `${theme.color.accent} url("data:image/svg+xml,${tick}") center / 68% no-repeat`,
                boxShadow: 'none',
            },
        },
        { dark: theme.dark }
    );

    class Bullet extends engine.WidgetType {
        eq() {
            return true;
        }
        toDOM() {
            return ui.element('span', { className: 'note-bullet', text: '•' });
        }
    }
    class Checkbox extends engine.WidgetType {
        constructor(checked) {
            super();
            this.checked = checked;
        }
        eq(other) {
            return other.checked === this.checked;
        }
        toDOM() {
            const box = ui.element('span', { className: 'note-check' });
            box.setAttribute('aria-checked', String(this.checked));
            return box;
        }
        ignoreEvent() {
            return false;
        }
    }
    class LanguageName extends engine.WidgetType {
        constructor(name) {
            super();
            this.name = name;
        }
        eq(other) {
            return other.name === this.name;
        }
        toDOM() {
            return ui.element('span', { text: this.name });
        }
    }
    const BULLET = engine.Decoration.replace({ widget: new Bullet() });
    const HIDDEN = engine.Decoration.replace({});

    let view = null;
    let readOnly = false;
    let currentTypeface = typeface;
    let slash = null; // { from } while the slash menu is open

    const element = ui.element('div', { style: { flex: '1 1 auto', minHeight: '0', position: 'relative' } });
    const typefaceCompartment = new engine.Compartment();
    const editableCompartment = new engine.Compartment();
    const preview = engine.ViewPlugin.fromClass(
        class {
            constructor(editorView) {
                this.decorations = decorationsOf(editorView);
            }
            update(update) {
                if (
                    update.docChanged ||
                    update.selectionSet ||
                    update.viewportChanged ||
                    update.focusChanged ||
                    engine.syntaxTree(update.startState) !== engine.syntaxTree(update.state)
                )
                    this.decorations = decorationsOf(update.view);
            }
        },
        { decorations: (mod) => mod.decorations }
    );
    const press = engine.EditorView.domEventHandlers({
        mousedown(event, editorView) {
            if (event.button !== 0) return false;
            const box = event.target.closest('.note-check');
            if (box) {
                event.preventDefault();
                toggleChecked(editorView.posAtDOM(box));
                return true;
            }
            const href = event.target.closest('.note-link')?.getAttribute('data-href');
            if (!href || !linkTargetOf(href) || event.altKey || event.shiftKey) return false;
            event.preventDefault();
            onFollowLink(href);
            return true;
        },
        contextmenu(event) {
            event.preventDefault();
            const href = event.target.closest('.note-link')?.getAttribute('data-href') ?? null;
            ui.menu({ items: contextMenuItems(href), point: { x: event.clientX, y: event.clientY } });
            return true;
        },
    });
    // The editor keeps the keyboard and steers the slash menu.
    const slashMenu = ui.autocomplete({ onPick: (item) => takeSlashCommand(item) });
    const toolbar = ui.floatingToolbar();
    // Highest, to beat the Markdown keymap, which the engine puts at high precedence itself.
    const keys = engine.Prec.highest(
        engine.keymap.of([
            { key: 'ArrowDown', run: slashKey(1) },
            { key: 'ArrowUp', run: slashKey(-1) },
            { key: 'Enter', run: (editorView) => slashKey('take')() || leaveQuote(editorView) },
            { key: 'Tab', run: slashKey('take') },
            { key: 'Escape', run: slashKey('close') },
            { key: 'Mod-b', run: wrap('**') },
            { key: 'Mod-i', run: wrap('*') },
            { key: 'Mod-Shift-x', run: wrap('~~') },
            { key: 'Mod-e', run: wrap('`') },
            {
                key: 'Mod-k',
                run: () => {
                    editLink();
                    return true;
                },
            },
            { key: 'Tab', run: engine.indentMore, shift: engine.indentLess },
        ])
    );
    const listener = engine.EditorView.updateListener.of((update) => {
        // Opening or replacing a note sets a new state, which is no docChanged update.
        if (update.docChanged) onChange();
        followSlash(update);
        if (update.docChanged || update.selectionSet || update.focusChanged || update.geometryChanged) followToolbar();
    });

    for (const [icon, title, run] of [
        [ui.iconOf(BOLD_SHAPES, { size: ICON_SIZE }), 'Bold (⌘B)', () => wrap('**')(view)],
        [ui.iconOf(ITALIC_SHAPES, { size: ICON_SIZE }), 'Italic (⌘I)', () => wrap('*')(view)],
        [ui.iconOf(STRIKETHROUGH_SHAPES, { size: ICON_SIZE }), 'Strikethrough (⇧⌘X)', () => wrap('~~')(view)],
        [ui.iconOf(CODE_SHAPES, { size: ICON_SIZE }), 'Code (⌘E)', () => wrap('`')(view)],
        [ui.icon('link', { size: ICON_SIZE }), 'Link (⌘K)', () => editLink()],
    ]) {
        const button = ui.iconButton({
            icon,
            title,
            onClick: () => {
                run();
                view.focus();
            },
            size: 'small',
        });
        toolbar.element.appendChild(button.element);
    }
    // Captured, so a scroll in any inner scroller moves the slash menu and the toolbar too.
    element.addEventListener(
        'scroll',
        () => {
            if (slash) placeSlashMenu();
            followToolbar();
        },
        true
    );

    return {
        element,
        open,
        replace,
        close,
        focus,
        setParagraphStyle,
        paragraphStyle,
        editLink,
        setReadOnly,
        toggleChecked: () => toggleChecked(),
        text: () => (view ? view.state.doc.toString() : ''),
        isOpen: () => !!view,
        hasFocus: () => !!view && view.hasFocus,
        selectionText,
        setTypeface: (next) => {
            currentTypeface = next;
            view?.dispatch({ effects: typefaceCompartment.reconfigure(typefaceTheme(next)) });
        },
    };

    function open({ text = '', readOnly: locked = false, at = 0 } = {}) {
        readOnly = locked;
        const state = engine.EditorState.create({
            doc: text,
            selection: { anchor: Math.max(0, Math.min(at, text.length)) },
            extensions: [
                engine.history(),
                engine.drawSelection(),
                engine.dropCursor(),
                engine.EditorView.lineWrapping,
                engine.indentUnit.of('  '),
                engine.markdown({ base: engine.markdownLanguage, codeLanguages: engine.codeLanguages }),
                keys,
                engine.keymap.of([...engine.defaultKeymap, ...engine.historyKeymap]),
                engine.syntaxHighlighting(highlight),
                editorTheme,
                typefaceCompartment.of(typefaceTheme(currentTypeface)),
                preview,
                press,
                listener,
                engine.placeholder('Start writing…'),
                editableCompartment.of(lockOf(locked)),
                // Blocks every change while read-only, including commands that ignore the read-only facet.
                engine.EditorState.transactionFilter.of((transaction) =>
                    readOnly && transaction.docChanged ? [] : transaction
                ),
            ],
        });
        hideFloats();
        if (view) view.setState(state);
        else {
            view = new engine.EditorView({ state, parent: element });
            // The engine ignores presses in the scroller's side margins, so one there is replayed at the nearest edge
            // of the text, keeping drags, double and triple clicks and shift-extend.
            view.scrollDOM.addEventListener('mousedown', (event) => {
                if (event.target !== view.scrollDOM || !event.isTrusted) return;
                const box = view.contentDOM.getBoundingClientRect();
                event.preventDefault();
                event.stopPropagation();
                view.contentDOM.dispatchEvent(
                    new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        detail: event.detail,
                        button: event.button,
                        buttons: event.buttons,
                        clientX: Math.min(Math.max(event.clientX, box.left + 1), box.right - 1),
                        clientY: event.clientY,
                        shiftKey: event.shiftKey,
                        altKey: event.altKey,
                        metaKey: event.metaKey,
                        ctrlKey: event.ctrlKey,
                    })
                );
            });
        }
        view.scrollDOM.scrollTop = 0;
    }

    // A fresh state: the old undo history replayed over the new text would corrupt it.
    function replace(text) {
        if (!view) return;
        const head = view.state.selection.main.head;
        const scroll = view.scrollDOM.scrollTop;
        open({ text, readOnly, at: head });
        view.scrollDOM.scrollTop = scroll;
    }

    function close() {
        hideFloats();
        view?.destroy();
        view = null;
    }

    function focus({ end = false } = {}) {
        if (!view) return;
        view.focus();
        if (end) view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
    }

    function selectionText() {
        return view ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) : '';
    }

    function setReadOnly(locked) {
        readOnly = !!locked;
        view?.dispatch({ effects: editableCompartment.reconfigure(lockOf(readOnly)) });
    }

    // When every selected line is already in the style, they all go back to body, so the same command toggles.
    function setParagraphStyle(key) {
        if (!view || readOnly) return;
        if (key === 'monospaced') return toggleFence();
        const style = PARAGRAPH_STYLES.find((candidate) => candidate.key === key);
        const { state } = view;
        const lines = selectedLines(state);
        const same = lines.every((line) => lineStyleAt(state, line) === key);
        let number = 0;
        const changes = lines.map((line) => {
            // Other styles change only what follows the quote marks, so an item in a quote stays in it.
            const quoted = QUOTE_MARKS.exec(line.text)?.[0] || '';
            if (key === 'blockQuote')
                return same
                    ? { from: line.from, to: line.from + quoted.length, insert: '' }
                    : { from: line.from, insert: '> ' };
            const lead = LEADING_MARK.exec(line.text.slice(quoted.length));
            const indent = /^(title|heading|subheading)$/.test(key) ? '' : lead[1];
            const mark = same ? '' : key === 'numberedList' ? `${++number}. ` : style.mark;
            const from = line.from + quoted.length;
            return { from, to: from + lead[0].length, insert: indent + mark };
        });
        // Mapped with associativity 1, so a caret at the start of a line lands after the new mark.
        const changeSet = state.changes(changes);
        view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet, 1), userEvent: 'input.format' });
        view.focus();
    }

    function paragraphStyle() {
        if (!view) return null;
        const { state } = view;
        if (fencedBlockAt(state, state.selection.main.head)) return 'monospaced';
        return lineStyleAt(state, state.doc.lineAt(state.selection.main.head));
    }

    function toggleFence() {
        const { state } = view;
        const block = fencedBlockAt(state, state.selection.main.head);
        if (block) {
            const first = state.doc.lineAt(block.from);
            const last = state.doc.lineAt(block.to);
            const changes = [{ from: first.from, to: Math.min(first.to + 1, state.doc.length), insert: '' }];
            if (last.number !== first.number && /^\s*(`{3,}|~{3,})\s*$/.test(last.text))
                changes.push({ from: Math.max(0, last.from - 1), to: last.to, insert: '' });
            view.dispatch({ changes, userEvent: 'input.format' });
            return view.focus();
        }
        const from = state.doc.lineAt(state.selection.main.from);
        const to = state.doc.lineAt(state.selection.main.to);
        view.dispatch({
            changes: [
                { from: from.from, insert: '```\n' },
                { from: to.to, insert: '\n```' },
            ],
            selection: { anchor: from.from + 4 + (state.selection.main.head - from.from) },
            userEvent: 'input.format',
        });
        view.focus();
    }

    function toggleChecked(onlyAt = null) {
        if (!view || readOnly) return false;
        const { state } = view;
        const lines = onlyAt != null ? [state.doc.lineAt(onlyAt)] : selectedLines(state);
        const boxes = lines.flatMap((line) => checkboxesOn(state, line));
        if (!boxes.length) return false;
        const checkAll = !boxes.every((box) => state.sliceDoc(box.from + 1, box.from + 2) !== ' ');
        view.dispatch({
            changes: boxes.map((box) => ({ from: box.from + 1, to: box.from + 2, insert: checkAll ? 'x' : ' ' })),
            userEvent: 'input.check',
        });
        return true;
    }

    function wrap(mark) {
        return (editorView) => {
            if (readOnly) return true;
            const { state } = editorView;
            editorView.dispatch(
                state.changeByRange((range) => {
                    const before = state.sliceDoc(range.from - mark.length, range.from);
                    const after = state.sliceDoc(range.to, range.to + mark.length);
                    if (before === mark && after === mark) {
                        return {
                            changes: [
                                { from: range.from - mark.length, to: range.from },
                                { from: range.to, to: range.to + mark.length },
                            ],
                            range: engine.EditorSelection.range(range.from - mark.length, range.to - mark.length),
                        };
                    }
                    return {
                        changes: [
                            { from: range.from, insert: mark },
                            { from: range.to, insert: mark },
                        ],
                        range: engine.EditorSelection.range(range.from + mark.length, range.to + mark.length),
                    };
                }),
                { userEvent: 'input.format' }
            );
            return true;
        };
    }

    function editLink() {
        if (!view || readOnly) return;
        const selection = view.state.selection.main;
        const link = linkAt(selection.head);
        const words = link ? link.label : view.state.sliceDoc(selection.from, selection.to);
        // If the text changes while the dialog is open (another note, a reload), its positions are stale.
        const askedDocument = view.state.doc;
        const askedView = view;
        ui.dialog({
            title: link ? 'Edit Link' : 'Add Link',
            confirmLabel: link ? 'Save' : 'Add',
            fields: [
                { key: 'text', label: 'Text', value: words, placeholder: 'Shown in the note' },
                {
                    key: 'url',
                    label: 'Address',
                    value: link ? link.href : linkTargetOf(words)?.address ? words : '',
                    placeholder: 'https:// or Other note.md',
                },
            ],
            onConfirm: ({ text = '', url = '' }) => {
                if (view !== askedView || view.state.doc !== askedDocument || readOnly) return;
                let href = url.trim();
                if (href && !isAddress(href) && !/\.md$/i.test(href)) href = 'https://' + href;
                const label = text.trim() || href;
                const from = link ? link.from : selection.from;
                const to = link ? link.to : selection.to;
                const insert = href ? `[${label.replace(/[[\]]/g, '\\$&')}](${linkDestinationOf(href)})` : label;
                view.dispatch({
                    changes: { from, to, insert },
                    selection: { anchor: from + insert.length },
                    userEvent: 'input.link',
                });
                view.focus();
            },
        });
    }

    function linkAt(position) {
        let found = null;
        engine.syntaxTree(view.state).iterate({
            from: position,
            to: position,
            enter: (node) => {
                if (node.name !== 'Link') return;
                const url = node.node.getChild('URL');
                const marks = node.node.getChildren('LinkMark');
                if (marks.length >= 2)
                    found = {
                        from: node.from,
                        to: node.to,
                        label: view.state.sliceDoc(marks[0].to, marks[1].from),
                        href: url ? view.state.sliceDoc(url.from, url.to) : '',
                    };
            },
        });
        return found;
    }

    // `href` is the link the menu was opened on, if any.
    function contextMenuItems(href) {
        const items = [];
        if (href) {
            items.push(
                {
                    label: 'Open Link',
                    icon: 'externalWindow',
                    disabled: !linkTargetOf(href),
                    run: () => onFollowLink(href),
                },
                { label: 'Copy Link', icon: 'link', run: () => copy(href) },
                { label: 'Edit Link…', hint: '⌘K', run: () => editLink() },
                '-'
            );
        }
        if (selectionText()) items.push({ label: 'Copy', hint: '⌘C', run: () => copy(selectionText()) }, '-');
        const current = paragraphStyle();
        items.push(
            ...PARAGRAPH_STYLES.map((style) =>
                style === '-'
                    ? '-'
                    : {
                          label: style.label,
                          hint: chordOf(style.key),
                          checked: current === style.key,
                          run: () => setParagraphStyle(style.key),
                      }
            )
        );
        return items;
    }

    function copy(text) {
        clipboard.writeText(text).catch(() => {});
    }

    function slashCommands() {
        return [
            {
                label: 'Title',
                aliases: ['heading 1', 'h1', '제목'],
                icon: ui.iconOf(HEADING_SHAPES, { size: ICON_SIZE }),
                hint: '#',
                run: () => setParagraphStyle('title'),
            },
            {
                label: 'Heading',
                aliases: ['heading 2', 'h2', '소제목'],
                icon: ui.iconOf(HEADING_SHAPES, { size: ICON_SIZE }),
                hint: '##',
                run: () => setParagraphStyle('heading'),
            },
            {
                label: 'Subheading',
                aliases: ['heading 3', 'h3'],
                icon: ui.iconOf(HEADING_SHAPES, { size: ICON_SIZE }),
                hint: '###',
                run: () => setParagraphStyle('subheading'),
            },
            {
                label: 'Checklist',
                aliases: ['todo', 'task', 'checkbox', '체크', '할일'],
                icon: ui.iconOf(CHECKLIST_SHAPES, { size: ICON_SIZE }),
                hint: '[ ]',
                run: () => setParagraphStyle('checklist'),
            },
            {
                label: 'Bulleted List',
                aliases: ['bullet', 'unordered', '목록'],
                icon: ui.icon('list', { size: ICON_SIZE }),
                hint: '-',
                run: () => setParagraphStyle('bulletedList'),
            },
            {
                label: 'Numbered List',
                aliases: ['number', 'ordered', '번호'],
                icon: ui.iconOf(NUMBERED_LIST_SHAPES, { size: ICON_SIZE }),
                hint: '1.',
                run: () => setParagraphStyle('numberedList'),
            },
            {
                label: 'Quote',
                aliases: ['blockquote', '인용'],
                icon: ui.iconOf(QUOTE_SHAPES, { size: ICON_SIZE }),
                hint: '>',
                run: () => setParagraphStyle('blockQuote'),
            },
            {
                label: 'Code Block',
                aliases: ['code', 'monospaced', 'fence', '코드'],
                icon: ui.iconOf(CODE_SHAPES, { size: ICON_SIZE }),
                hint: '```',
                run: () => setParagraphStyle('monospaced'),
            },
            {
                label: 'Divider',
                aliases: ['rule', 'line', 'hr', '구분선'],
                icon: ui.iconOf(DIVIDER_SHAPES, { size: ICON_SIZE }),
                hint: '---',
                run: () => insertDivider(),
            },
            {
                label: 'Link…',
                aliases: ['url', 'address', '링크'],
                icon: ui.icon('link', { size: ICON_SIZE }),
                hint: '⌘K',
                run: () => editLink(),
            },
            {
                label: "Today's Date",
                aliases: ['date', 'today', '날짜', '오늘'],
                icon: ui.icon('calendar', { size: ICON_SIZE }),
                run: () => insertText(localDate(Date.now())),
            },
        ];
    }

    // Each name is matched on its own: joined, a short alias would be scored as the start of a long string.
    function slashCommandsMatching(query) {
        if (!query) return slashCommands();
        const best = (command) =>
            [command.label, ...command.aliases]
                .map((text) => match(text, query))
                .filter(Boolean)
                .sort((one, other) => other.tier - one.tier || other.score - one.score)[0] || null;
        return slashCommands()
            .map((command, index) => ({ command, index, found: best(command) }))
            .filter((candidate) => candidate.found)
            .sort(
                (one, other) =>
                    other.found.tier - one.found.tier || other.found.score - one.found.score || one.index - other.index
            )
            .map((candidate) => candidate.command);
    }

    function insertText(text) {
        const selection = view.state.selection.main;
        view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: text },
            selection: { anchor: selection.from + text.length },
            userEvent: 'input',
        });
    }

    // An empty line above it: "---" right under a paragraph makes that paragraph a heading.
    function insertDivider() {
        const { state } = view;
        const line = state.doc.lineAt(state.selection.main.head);
        const empty = !line.text.trim();
        const above = empty ? (line.number > 1 ? state.doc.line(line.number - 1).text : '') : line.text;
        const insert = (empty ? '' : '\n') + (above.trim() ? '\n' : '') + '---\n';
        const from = empty ? line.from : line.to;
        view.dispatch({
            changes: { from, to: empty ? line.to : from, insert },
            selection: { anchor: from + insert.length },
            userEvent: 'input',
        });
    }

    function closeSlashMenu() {
        slash = null;
        slashMenu.close();
    }

    function placeSlashMenu() {
        const at = view.coordsAtPos(slash.from);
        if (!at) closeSlashMenu();
        else slashMenu.place(at);
    }

    function takeSlashCommand(command) {
        if (!slash) return;
        const from = slash.from;
        const to = view.state.selection.main.head;
        closeSlashMenu();
        view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from }, userEvent: 'delete' });
        command.run();
    }

    function followSlash(update) {
        if (readOnly || !update.view.hasFocus) {
            if (slash) closeSlashMenu();
            return;
        }
        const { state } = update;
        const head = state.selection.main.head;
        if (slash && update.docChanged) slash.from = update.changes.mapPos(slash.from, -1);
        else if (
            !slash &&
            update.docChanged &&
            state.selection.main.empty &&
            state.sliceDoc(head - 1, head) === '/' &&
            update.transactions.some((transaction) => transaction.isUserEvent('input.type'))
        ) {
            const before = state.sliceDoc(head - 2, head - 1);
            if (head - 1 === state.doc.lineAt(head).from || /\s/.test(before)) slash = { from: head - 1 };
        }
        if (!slash) return;
        if (isInCode(state, slash.from)) return closeSlashMenu();
        const line = state.doc.lineAt(slash.from);
        const query = head > slash.from ? state.sliceDoc(slash.from + 1, head) : null;
        if (
            query == null ||
            state.sliceDoc(slash.from, slash.from + 1) !== '/' ||
            head > line.to ||
            /\s/.test(query) ||
            !state.selection.main.empty
        )
            return closeSlashMenu();
        const commands = slashCommandsMatching(query);
        if (!commands.length) return closeSlashMenu();
        const at = view.coordsAtPos(slash.from);
        if (!at) return closeSlashMenu();
        slashMenu.show(commands, at);
    }

    function slashKey(step) {
        return () => {
            if (!slash) return false;
            if (step === 'take') slashMenu.pick();
            else if (step === 'close') closeSlashMenu();
            else slashMenu.move(step);
            return true;
        };
    }

    function followToolbar() {
        const selection = view?.state.selection.main;
        const shown =
            !!view &&
            view.hasFocus &&
            !readOnly &&
            !slash &&
            !selection.empty &&
            view.state.doc.lineAt(selection.from).number === view.state.doc.lineAt(selection.to).number;
        const start = shown && view.coordsAtPos(selection.from);
        const end = shown && view.coordsAtPos(selection.to);
        if (!start || !end) return toolbar.hide();
        toolbar.show({ left: start.left, right: end.right, top: start.top, bottom: end.bottom });
    }

    function hideFloats() {
        closeSlashMenu();
        toolbar.hide();
    }

    // The engine's own Enter would carry an empty ">" on to the next line.
    function leaveQuote(editorView) {
        const selection = editorView.state.selection.main;
        if (readOnly || !selection.empty) return false;
        const line = editorView.state.doc.lineAt(selection.head);
        if (!/^\s*>\s*$/.test(line.text)) return false;
        editorView.dispatch({
            changes: { from: line.from, to: line.to, insert: '' },
            selection: { anchor: line.from },
            userEvent: 'input.format',
        });
        return true;
    }

    function lockOf(locked) {
        return [engine.EditorView.editable.of(!locked), engine.EditorState.readOnly.of(locked)];
    }

    function typefaceTheme({ size, font }) {
        return engine.EditorView.theme({ '.cm-scroller': { fontSize: size + 'px', fontFamily: font } });
    }

    function selectedLines(state) {
        const numbers = new Set();
        for (const range of state.selection.ranges) {
            const last = state.doc.lineAt(range.to).number;
            for (let number = state.doc.lineAt(range.from).number; number <= last; number++) numbers.add(number);
        }
        return [...numbers].map((number) => state.doc.line(number));
    }

    // Read off the syntax tree, so the menu, the commands and the drawing never disagree. The innermost style the line
    // starts wins: "> - [ ] a" is a checklist item.
    function lineStyleAt(state, line) {
        let style = 'body';
        let rank = 0;
        const take = (candidate, candidateRank) => {
            if (candidateRank <= rank) return;
            style = candidate;
            rank = candidateRank;
        };
        engine.syntaxTree(state).iterate({
            from: line.from,
            to: line.to,
            enter: (node) => {
                const starts = node.from >= line.from && node.from <= line.to;
                if (node.name === 'FencedCode' || node.name === 'CodeBlock') take('monospaced', 4);
                else if (/^ATXHeading\d$/.test(node.name) && starts)
                    take(
                        node.name === 'ATXHeading1' ? 'title' : node.name === 'ATXHeading2' ? 'heading' : 'subheading',
                        3
                    );
                else if (node.name === 'ListItem' && starts)
                    take(
                        node.node.getChild('Task')
                            ? 'checklist'
                            : node.node.parent.name === 'OrderedList'
                              ? 'numberedList'
                              : 'bulletedList',
                        2
                    );
                // A lazy continuation line has no quote mark of its own, so a quote toggle could not remove one.
                else if (node.name === 'QuoteMark' && starts) take('blockQuote', 1);
            },
        });
        return style;
    }

    function fencedBlockAt(state, position) {
        let block = null;
        engine.syntaxTree(state).iterate({
            from: position,
            to: position,
            enter: (node) => {
                if (node.name === 'FencedCode') block = node.node;
            },
        });
        return block;
    }

    function isInCode(state, position) {
        for (let node = engine.syntaxTree(state).resolveInner(position, -1); node; node = node.parent)
            if (/^(FencedCode|CodeBlock|InlineCode|CodeText)$/.test(node.name)) return true;
        return false;
    }

    function checkboxesOn(state, line) {
        const found = [];
        engine.syntaxTree(state).iterate({
            from: line.from,
            to: line.to,
            enter: (node) => {
                if (node.name === 'TaskMarker' && node.from >= line.from && node.to <= line.to)
                    found.push({ from: node.from, to: node.to });
            },
        });
        return found;
    }

    // The numbers of the selected lines while the editor has focus, where the marks are shown as typed.
    function activeLines(editorView) {
        if (!editorView.hasFocus) return new Set();
        return new Set(selectedLines(editorView.state).map((line) => line.number));
    }

    function decorationsOf(editorView) {
        const { state } = editorView;
        const text = state.doc;
        const active = activeLines(editorView);
        const isActive = (from, to = from) => {
            for (let number = text.lineAt(from).number, last = text.lineAt(to).number; number <= last; number++)
                if (active.has(number)) return true;
            return false;
        };
        const decorations = [];
        // The engine rejects an empty mark and a mod replacement that spans a line break, which would take the
        // whole preview down. Every decoration goes through these two.
        const mark = (from, to, decoration) => {
            if (to > from) decorations.push(decoration.range(from, to));
        };
        const replaceRange = (from, to, decoration = HIDDEN) => {
            for (let line = text.lineAt(from); ; line = text.line(line.number + 1)) {
                const start = Math.max(from, line.from);
                const end = Math.min(to, line.to);
                if (end > start || (end === start && decoration !== HIDDEN && start === from))
                    decorations.push((start === from ? decoration : HIDDEN).range(start, end));
                if (line.to >= to || line.number === text.lines) break;
            }
        };
        const lineClass = (position, className) =>
            decorations.push(engine.Decoration.line({ class: className }).range(text.lineAt(position).from));
        const withSpace = (node) => (text.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to);
        const linkMark = (href) => engine.Decoration.mark({ class: 'note-link', attributes: { 'data-href': href } });
        for (const { from, to } of editorView.visibleRanges) {
            engine.syntaxTree(state).iterate({
                from,
                to,
                enter: (node) => {
                    const name = node.name;
                    const heading = /^ATXHeading(\d)$/.exec(name);
                    if (heading) {
                        lineClass(node.from, 'note-h' + Math.min(3, Number(heading[1])));
                        return;
                    }
                    if (name === 'HeaderMark') {
                        if (!isActive(node.from) && node.from === text.lineAt(node.from).from)
                            replaceRange(node.from, withSpace(node));
                        return;
                    }
                    if (name === 'Blockquote') {
                        const last = text.lineAt(node.to).number;
                        for (let number = text.lineAt(node.from).number; number <= last; number++)
                            lineClass(text.line(number).from, 'note-quote');
                        return;
                    }
                    if (name === 'QuoteMark') {
                        if (!isActive(node.from)) replaceRange(node.from, withSpace(node));
                        return;
                    }
                    if (name === 'FencedCode' || name === 'CodeBlock') {
                        const first = text.lineAt(node.from).number;
                        const last = text.lineAt(node.to).number;
                        // A block still being written has no closing fence.
                        const fences = new Set(
                            node.node.getChildren('CodeMark').map((fence) => text.lineAt(fence.from).number)
                        );
                        const shown = isActive(node.from, node.to);
                        const info = node.node.getChild('CodeInfo');
                        for (let number = first; number <= last; number++) {
                            const line = text.line(number);
                            const isFence = fences.has(number);
                            lineClass(
                                line.from,
                                'note-code' +
                                    (number === first ? ' note-code-first' : '') +
                                    (number === last ? ' note-code-last' : '') +
                                    (isFence ? (shown ? ' note-fence' : ' note-fence-folded') : '')
                            );
                            if (!isFence || shown || line.to === line.from) continue;
                            if (number === first && info)
                                replaceRange(
                                    line.from,
                                    line.to,
                                    engine.Decoration.replace({
                                        widget: new LanguageName(text.sliceString(info.from, info.to)),
                                    })
                                );
                            else replaceRange(line.from, line.to);
                        }
                        return false;
                    }
                    if (name === 'InlineCode') {
                        mark(node.from, node.to, engine.Decoration.mark({ class: 'note-inline-code' }));
                        return;
                    }
                    if (name === 'CodeMark' || name === 'EmphasisMark' || name === 'StrikethroughMark') {
                        if (!isActive(node.from)) replaceRange(node.from, node.to);
                        return;
                    }
                    if (name === 'Link') {
                        const url = node.node.getChild('URL');
                        const href = url ? text.sliceString(url.from, url.to) : '';
                        const marks = node.node.getChildren('LinkMark');
                        if (marks.length >= 2 && href && linkTargetOf(href)) {
                            const labelFrom = marks[0].to;
                            const labelTo = marks[1].from;
                            mark(labelFrom, labelTo, linkMark(href));
                            // With no words, the address stays in sight so there is something to click.
                            if (!isActive(node.from, node.to) && labelTo > labelFrom) {
                                replaceRange(node.from, labelFrom);
                                replaceRange(labelTo, node.to);
                            }
                        }
                        return false;
                    }
                    if (name === 'URL' || name === 'Autolink') {
                        const href = text.sliceString(node.from, node.to).replace(/^<|>$/g, '');
                        if (linkTargetOf(href)?.address) mark(node.from, node.to, linkMark(href));
                        return false;
                    }
                    if (name === 'HorizontalRule') {
                        if (!isActive(node.from)) {
                            lineClass(node.from, 'note-rule');
                            replaceRange(node.from, node.to);
                        }
                        return;
                    }
                    if (name === 'ListItem') {
                        const listMark = node.node.getChild('ListMark');
                        const marker = node.node.getChild('Task')?.getChild('TaskMarker');
                        if (!listMark) return;
                        const isBullet = /^[-*+]$/.test(text.sliceString(listMark.from, listMark.to));
                        if (marker) {
                            const checked = /x/i.test(text.sliceString(marker.from, marker.to));
                            if (checked) lineClass(node.from, 'note-done');
                            // A numbered item keeps its number; a bulleted one needs no bullet beside a box.
                            if (!isActive(node.from)) {
                                if (isBullet) replaceRange(listMark.from, withSpace(listMark));
                                replaceRange(
                                    marker.from,
                                    marker.to,
                                    engine.Decoration.replace({ widget: new Checkbox(checked) })
                                );
                                if (text.sliceString(marker.to, marker.to + 1) === ' ')
                                    replaceRange(marker.to, marker.to + 1);
                            }
                        } else if (isBullet && !isActive(node.from)) {
                            replaceRange(listMark.from, withSpace(listMark), BULLET);
                        }
                    }
                },
            });
        }
        return engine.Decoration.set(decorations, true);
    }
}

module.exports = { liveEditor };
