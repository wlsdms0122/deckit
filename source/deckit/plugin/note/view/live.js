/* The document is the file's text exactly; formatting is only decorations drawn over it. */
const NOTE_MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

const NOTE_KINDS = [
    { key: 'title', label: 'Title', mark: '# ' },
    { key: 'heading', label: 'Heading', mark: '## ' },
    { key: 'subheading', label: 'Subheading', mark: '### ' },
    { key: 'body', label: 'Body', mark: '' },
    { key: 'mono', label: 'Monospaced' },
    '-',
    { key: 'bullet', label: 'Bulleted List', mark: '- ' },
    { key: 'number', label: 'Numbered List', mark: '1. ' },
    { key: 'check', label: 'Checklist', mark: '- [ ] ' },
    '-',
    { key: 'quote', label: 'Block Quote', mark: '> ' },
];
const NOTE_KIND = Object.fromEntries(NOTE_KINDS.filter((k) => k !== '-').map((k) => [k.key, k]));
// Only for replacing the mark at a line start. What a line is comes from the syntax tree (lineKindAt).
const NOTE_LEAD = /^(\s*)(#{1,6}\s+|(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;
const NOTE_QUOTE = /^(\s*>\s?)+/;
// A parenthesis or a space would end a link destination early. A no-break space encodes as two bytes.
const linkAddress = (href) =>
    String(href)
        .replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))
        .replace(/\s/g, encodeURIComponent);
// Local date, not UTC: before nine in the morning in Seoul, UTC is still yesterday.
const noteToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const NOTE_ADDRESS = /^[a-z][a-z0-9+.-]*:/i;
// A "note" path is relative to the current note.
const noteLinkTarget = (href) => {
    const raw = String(href || '').trim();
    if (NOTE_ADDRESS.test(raw)) return { kind: 'address', href: raw };
    if (raw.startsWith('/')) return { kind: 'none' };
    let path;
    try {
        path = decodeURIComponent(raw.replace(/^<|>$/g, ''));
    } catch {
        return { kind: 'none' };
    }
    return /\.md$/i.test(path) ? { kind: 'note', path } : { kind: 'none' };
};
// host.open answers only whether anything opened the address, not why it did not.
const noteOpenAddress = async ({ host, ui }, href) => {
    if (await host.open(href, { userInitiated: true }).catch(() => false)) return;
    ui.dialog({ title: 'Could not open the link', message: href, confirmLabel: 'OK' });
};

const noteLive = ({ theme, ui, host, match, type: firstType, onChange, onOpenNote, onMenu }) => {
    const E = NoteEngine;
    const quiet = ui.blend(theme.contentColor, theme.contentBg, 0.5);
    const dark = (() => {
        const m = String(theme.contentBg || '').match(/^#([0-9a-f]{6})$/i);
        const rgb = m
            ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
            : (String(theme.contentBg).match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
        return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
    })();
    const C = dark
        ? {
              keyword: '#c678dd',
              string: '#98c379',
              number: '#d19a66',
              comment: '#7f848e',
              fn: '#61afef',
              type: '#e5c07b',
              prop: '#e06c75',
          }
        : {
              keyword: '#cf222e',
              string: '#0a3069',
              number: '#0550ae',
              comment: '#6e7781',
              fn: '#8250df',
              type: '#953800',
              prop: '#116329',
          };
    const linkColor = ui.blend(ui.accent, theme.contentColor, 0.85);
    // Translucent: the panel is glass, and a solid ground reads as a hole in it.
    const codeGround = ui.alpha(theme.contentColor, 0.07);

    const t = E.tags;
    const highlight = E.HighlightStyle.define([
        { tag: t.heading1, fontSize: '1.6em', fontWeight: '800', letterSpacing: '-.01em' },
        { tag: t.heading2, fontSize: '1.3em', fontWeight: '700' },
        { tag: t.heading3, fontSize: '1.12em', fontWeight: '700' },
        { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '700' },
        { tag: t.strong, fontWeight: '700' },
        { tag: t.emphasis, fontStyle: 'italic' },
        { tag: t.strikethrough, textDecoration: 'line-through' },
        { tag: t.link, color: linkColor },
        { tag: t.url, color: quiet },
        { tag: t.monospace, fontFamily: NOTE_MONO, fontSize: '.9em' },
        { tag: [t.processingInstruction, t.contentSeparator, t.labelName], color: quiet },
        { tag: t.quote, color: ui.blend(theme.contentColor, theme.contentBg, 0.78) },
        // Fenced code in the languages the engine carries.
        { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.modifier], color: C.keyword },
        { tag: [t.string, t.regexp], color: C.string },
        { tag: [t.number, t.bool, t.null], color: C.number },
        { tag: [t.comment, t.lineComment, t.blockComment], color: C.comment, fontStyle: 'italic' },
        { tag: [t.function(t.variableName), t.function(t.propertyName)], color: C.fn },
        { tag: [t.typeName, t.className], color: C.type },
        { tag: t.propertyName, color: C.prop },
    ]);

    const tick = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`
    );
    const look = E.EditorView.theme(
        {
            '&': { height: '100%', color: theme.contentColor, backgroundColor: 'transparent' },
            '&.cm-focused': { outline: 'none' },
            // The font face is set only by typeOf below, so two rules never race.
            /* The side margin is on the scroller: the engine paints a selected line from the content's
       outer edge, so a margin inside the content would be painted too. */
            '.cm-scroller': { lineHeight: '1.6', overflowX: 'hidden', padding: '0 28px' },
            '.cm-content': { padding: '4px 0 40vh', caretColor: ui.accent, width: '100%', boxSizing: 'border-box' },
            '.cm-line': { padding: '0' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: ui.accent, borderLeftWidth: '2px' },
            '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
                { backgroundColor: ui.alpha(ui.accent, 0.28) },
            '.cm-placeholder': { color: quiet },
            '.sk-md-h1': { paddingTop: '.35em !important' },
            '.sk-md-h2': { paddingTop: '.5em !important' },
            '.sk-md-h3': { paddingTop: '.35em !important' },
            '.sk-md-quote': { borderLeft: '3px solid rgba(128,128,128,.45)', paddingLeft: '.85em !important' },
            '.sk-md-code': {
                fontFamily: NOTE_MONO,
                fontSize: '.9em',
                backgroundColor: codeGround,
                padding: '0 .8em !important',
            },
            '.sk-md-code-first': {
                borderTopLeftRadius: '7px',
                borderTopRightRadius: '7px',
                paddingTop: '.3em !important',
            },
            '.sk-md-code-last': {
                borderBottomLeftRadius: '7px',
                borderBottomRightRadius: '7px',
                paddingBottom: '.3em !important',
            },
            '.sk-md-fence': { color: quiet, fontSize: '.8em' },
            '.sk-md-fence-off': { color: quiet, fontSize: '.7em', lineHeight: '1.1', textAlign: 'right' },
            '.sk-md-inline-code': {
                backgroundColor: ui.alpha(theme.contentColor, 0.1),
                borderRadius: '4px',
                padding: '.05em .25em',
            },
            '.sk-md-link': {
                color: linkColor,
                textDecoration: 'underline',
                textDecorationColor: ui.alpha(ui.accent, 0.45),
                textUnderlineOffset: '2px',
                cursor: 'pointer',
            },
            '.sk-md-done': { color: quiet },
            '.sk-md-hr': {
                borderBottom: '1px solid rgba(128,128,128,.35)',
                lineHeight: '.8 !important',
                marginBottom: '.6em',
            },
            '.sk-md-bullet': { display: 'inline-block', width: '1.1em', color: quiet, textAlign: 'left' },
            '.sk-md-check': {
                display: 'inline-block',
                verticalAlign: '-.15em',
                width: '1.05em',
                height: '1.05em',
                marginRight: '.45em',
                boxSizing: 'border-box',
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 1.5px ${quiet}`,
                cursor: 'pointer',
            },
            '.sk-md-check.sk-on': {
                background: `${ui.accent} url("data:image/svg+xml,${tick}") center / 68% no-repeat`,
                boxShadow: 'none',
            },
        },
        { dark }
    );

    class Bullet extends E.WidgetType {
        eq() {
            return true;
        }
        toDOM() {
            const s = document.createElement('span');
            s.className = 'sk-md-bullet';
            s.textContent = '\u2022';
            return s;
        }
    }
    class Check extends E.WidgetType {
        constructor(on) {
            super();
            this.on = on;
        }
        eq(other) {
            return other.on === this.on;
        }
        toDOM() {
            const s = document.createElement('span');
            s.className = 'sk-md-check' + (this.on ? ' sk-on' : '');
            s.setAttribute('aria-checked', String(this.on));
            return s;
        }
        ignoreEvent() {
            return false;
        }
    }
    class Language extends E.WidgetType {
        constructor(name) {
            super();
            this.name = name;
        }
        eq(other) {
            return other.name === this.name;
        }
        toDOM() {
            const s = document.createElement('span');
            s.textContent = this.name;
            return s;
        }
    }
    const BULLET = E.Decoration.replace({ widget: new Bullet() });
    const HIDE = E.Decoration.replace({});
    const line = (cls) => E.Decoration.line({ class: cls });

    const activeLines = (view) => {
        const lines = new Set();
        if (!view.hasFocus) return lines;
        for (const r of view.state.selection.ranges) {
            const a = view.state.doc.lineAt(r.from).number,
                b = view.state.doc.lineAt(r.to).number;
            for (let n = a; n <= b; n++) lines.add(n);
        }
        return lines;
    };

    const build = (view) => {
        const { state } = view;
        const doc = state.doc;
        const active = activeLines(view);
        const on = (from, to = from) => {
            for (let n = doc.lineAt(from).number, last = doc.lineAt(to).number; n <= last; n++)
                if (active.has(n)) return true;
            return false;
        };
        const out = [];
        /* The engine rejects an empty mark and a plugin replacement that spans a line break, which
       would take the whole preview down. Every decoration goes through these two. */
        const mark = (from, to, deco) => {
            if (to > from) out.push(deco.range(from, to));
        };
        const replace = (from, to, deco = HIDE) => {
            for (let l = doc.lineAt(from); ; l = doc.line(l.number + 1)) {
                const a = Math.max(from, l.from),
                    b = Math.min(to, l.to);
                if (b > a || (b === a && deco !== HIDE && a === from)) out.push((a === from ? deco : HIDE).range(a, b));
                if (l.to >= to || l.number === doc.lines) break;
            }
        };
        const lineDeco = (pos, cls) => out.push(line(cls).range(doc.lineAt(pos).from));
        const withSpace = (node) => (doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to);
        for (const { from, to } of view.visibleRanges) {
            E.syntaxTree(state).iterate({
                from,
                to,
                enter: (node) => {
                    const name = node.name;
                    const h = /^ATXHeading(\d)$/.exec(name);
                    if (h) {
                        lineDeco(node.from, 'sk-md-h' + Math.min(3, Number(h[1])));
                        return;
                    }
                    if (name === 'HeaderMark') {
                        if (!on(node.from) && node.from === doc.lineAt(node.from).from)
                            replace(node.from, withSpace(node));
                        return;
                    }
                    if (name === 'Blockquote') {
                        for (let n = doc.lineAt(node.from).number; n <= doc.lineAt(node.to).number; n++)
                            lineDeco(doc.line(n).from, 'sk-md-quote');
                        return;
                    }
                    if (name === 'QuoteMark') {
                        if (!on(node.from)) replace(node.from, withSpace(node));
                        return;
                    }
                    if (name === 'FencedCode' || name === 'CodeBlock') {
                        const a = doc.lineAt(node.from).number,
                            b = doc.lineAt(node.to).number;
                        // A block still being written has no closing fence.
                        const fences = new Set(node.node.getChildren('CodeMark').map((m) => doc.lineAt(m.from).number));
                        const shown = on(node.from, node.to);
                        const info = node.node.getChild('CodeInfo');
                        for (let n = a; n <= b; n++) {
                            const l = doc.line(n),
                                fence = fences.has(n);
                            lineDeco(
                                l.from,
                                'sk-md-code' +
                                    (n === a ? ' sk-md-code-first' : '') +
                                    (n === b ? ' sk-md-code-last' : '') +
                                    (fence ? (shown ? ' sk-md-fence' : ' sk-md-fence-off') : '')
                            );
                            if (!fence || shown || l.to === l.from) continue;
                            if (n === a && info)
                                replace(
                                    l.from,
                                    l.to,
                                    E.Decoration.replace({ widget: new Language(doc.sliceString(info.from, info.to)) })
                                );
                            else replace(l.from, l.to);
                        }
                        return false;
                    }
                    if (name === 'InlineCode') {
                        mark(node.from, node.to, E.Decoration.mark({ class: 'sk-md-inline-code' }));
                        return;
                    }
                    if (name === 'CodeMark' || name === 'EmphasisMark' || name === 'StrikethroughMark') {
                        if (!on(node.from)) replace(node.from, node.to);
                        return;
                    }
                    if (name === 'Link') {
                        const url = node.node.getChild('URL');
                        const href = url ? doc.sliceString(url.from, url.to) : '';
                        const marks = node.node.getChildren('LinkMark');
                        if (marks.length >= 2 && href && noteLinkTarget(href).kind !== 'none') {
                            const labelFrom = marks[0].to,
                                labelTo = marks[1].from;
                            mark(
                                labelFrom,
                                labelTo,
                                E.Decoration.mark({ class: 'sk-md-link', attributes: { 'data-href': href } })
                            );
                            // With no words, the address stays visible so there is something to click.
                            if (!on(node.from, node.to) && labelTo > labelFrom) {
                                replace(node.from, labelFrom);
                                replace(labelTo, node.to);
                            }
                        }
                        return false;
                    }
                    if (name === 'URL' || name === 'Autolink') {
                        const href = doc.sliceString(node.from, node.to).replace(/^<|>$/g, '');
                        if (noteLinkTarget(href).kind === 'address')
                            mark(
                                node.from,
                                node.to,
                                E.Decoration.mark({ class: 'sk-md-link', attributes: { 'data-href': href } })
                            );
                        return false;
                    }
                    if (name === 'HorizontalRule') {
                        if (!on(node.from)) {
                            lineDeco(node.from, 'sk-md-hr');
                            replace(node.from, node.to);
                        }
                        return;
                    }
                    if (name === 'ListItem') {
                        const listMark = node.node.getChild('ListMark');
                        const marker = node.node.getChild('Task')?.getChild('TaskMarker');
                        if (!listMark) return;
                        const bullet = /^[-*+]$/.test(doc.sliceString(listMark.from, listMark.to));
                        if (marker) {
                            const done = /x/i.test(doc.sliceString(marker.from, marker.to));
                            if (done) lineDeco(node.from, 'sk-md-done');
                            // A numbered item keeps its number; a bulleted one needs no bullet beside a box.
                            if (!on(node.from)) {
                                if (bullet) replace(listMark.from, withSpace(listMark));
                                replace(marker.from, marker.to, E.Decoration.replace({ widget: new Check(done) }));
                                if (doc.sliceString(marker.to, marker.to + 1) === ' ')
                                    replace(marker.to, marker.to + 1);
                            }
                        } else if (bullet && !on(node.from)) {
                            replace(listMark.from, withSpace(listMark), BULLET);
                        }
                    }
                },
            });
        }
        return E.Decoration.set(out, true);
    };

    const preview = E.ViewPlugin.fromClass(
        class {
            constructor(view) {
                this.decorations = build(view);
            }
            update(u) {
                if (
                    u.docChanged ||
                    u.selectionSet ||
                    u.viewportChanged ||
                    u.focusChanged ||
                    E.syntaxTree(u.startState) !== E.syntaxTree(u.state)
                )
                    this.decorations = build(u.view);
            }
        },
        { decorations: (v) => v.decorations }
    );

    /* Read off the syntax tree so the toolbar, format and the drawing never disagree. The innermost
     kind the line starts wins: "> - [ ] a" is a checklist item, not a quote. */
    const lineKindAt = (state, l) => {
        let kind = 'body',
            rank = 0;
        const take = (k, r) => {
            if (r > rank) {
                kind = k;
                rank = r;
            }
        };
        E.syntaxTree(state).iterate({
            from: l.from,
            to: l.to,
            enter: (n) => {
                const starts = n.from >= l.from && n.from <= l.to;
                if (n.name === 'FencedCode' || n.name === 'CodeBlock') take('mono', 4);
                else if (/^ATXHeading\d$/.test(n.name) && starts)
                    take(n.name === 'ATXHeading1' ? 'title' : n.name === 'ATXHeading2' ? 'heading' : 'subheading', 3);
                else if (n.name === 'ListItem' && starts)
                    take(
                        n.node.getChild('Task') ? 'check' : n.node.parent?.name === 'OrderedList' ? 'number' : 'bullet',
                        2
                    );
                // A lazy continuation line has no quote mark of its own, so a quote toggle cannot remove one.
                else if (n.name === 'QuoteMark' && starts) take('quote', 1);
            },
        });
        return kind;
    };
    const inCode = (state, pos) => {
        for (let n = E.syntaxTree(state).resolveInner(pos, -1); n; n = n.parent)
            if (/^(FencedCode|CodeBlock|InlineCode|CodeText)$/.test(n.name)) return true;
        return false;
    };
    const markersOn = (state, l) => {
        const found = [];
        E.syntaxTree(state).iterate({
            from: l.from,
            to: l.to,
            enter: (n) => {
                if (n.name === 'TaskMarker' && n.from >= l.from && n.to <= l.to) found.push({ from: n.from, to: n.to });
            },
        });
        return found;
    };

    let view = null;
    let readOnly = false;

    // When every selected line is already `key`, they all go back to body, so the same command toggles.
    const format = (key) => {
        if (!view || readOnly) return;
        if (key === 'mono') return fence();
        const kind = NOTE_KIND[key];
        if (!kind) return;
        const { state } = view;
        const lines = new Set();
        for (const r of state.selection.ranges)
            for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) lines.add(n);
        const all = [...lines].map((n) => state.doc.line(n));
        const same = all.every((l) => lineKindAt(state, l) === key);
        let count = 0;
        const changes = all.map((l) => {
            // Other kinds change only what follows the quote mark, so an item in a quote stays in it.
            const quoted = NOTE_QUOTE.exec(l.text)?.[0] || '';
            if (key === 'quote')
                return same ? { from: l.from, to: l.from + quoted.length, insert: '' } : { from: l.from, insert: '> ' };
            const m = NOTE_LEAD.exec(l.text.slice(quoted.length));
            const indent = /^(title|heading|subheading)$/.test(key) ? '' : m[1];
            const mark = same ? '' : key === 'number' ? `${++count}. ` : kind.mark;
            const from = l.from + quoted.length;
            return { from, to: from + m[0].length, insert: indent + mark };
        });
        // Mapped with associativity 1, so a caret at the start of a line lands after the new mark.
        const set = state.changes(changes);
        view.dispatch({ changes: set, selection: state.selection.map(set, 1), userEvent: 'input.format' });
        view.focus();
    };

    const fence = () => {
        const { state } = view;
        let block = null;
        E.syntaxTree(state).iterate({
            from: state.selection.main.head,
            to: state.selection.main.head,
            enter: (n) => {
                if (n.name === 'FencedCode') block = n.node;
            },
        });
        if (block) {
            const first = state.doc.lineAt(block.from),
                last = state.doc.lineAt(block.to);
            const changes = [{ from: first.from, to: Math.min(first.to + 1, state.doc.length), insert: '' }];
            if (last.number !== first.number && /^\s*(`{3,}|~{3,})\s*$/.test(last.text))
                changes.push({ from: Math.max(0, last.from - 1), to: last.to, insert: '' });
            view.dispatch({ changes, userEvent: 'input.format' });
            return view.focus();
        }
        const from = state.doc.lineAt(state.selection.main.from),
            to = state.doc.lineAt(state.selection.main.to);
        view.dispatch({
            changes: [
                { from: from.from, insert: '```\n' },
                { from: to.to, insert: '\n```' },
            ],
            selection: { anchor: from.from + 4 + (state.selection.main.head - from.from) },
            userEvent: 'input.format',
        });
        view.focus();
    };

    const toggleChecked = (onlyLine = null) => {
        if (!view || readOnly) return false;
        const { state } = view;
        const lines =
            onlyLine != null
                ? [state.doc.lineAt(onlyLine)]
                : (() => {
                      const set = new Set();
                      for (const r of state.selection.ranges)
                          for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++)
                              set.add(n);
                      return [...set].map((n) => state.doc.line(n));
                  })();
        const boxes = lines.flatMap((l) => markersOn(state, l));
        if (!boxes.length) return false;
        const tickAll = !boxes.every((b) => state.sliceDoc(b.from + 1, b.from + 2) !== ' ');
        view.dispatch({
            changes: boxes.map((b) => ({ from: b.from + 1, to: b.from + 2, insert: tickAll ? 'x' : ' ' })),
            userEvent: 'input.check',
        });
        return true;
    };

    const wrap = (mark) => (v) => {
        if (readOnly) return true;
        const { state } = v;
        v.dispatch(
            state.changeByRange((r) => {
                const before = state.sliceDoc(r.from - mark.length, r.from),
                    after = state.sliceDoc(r.to, r.to + mark.length);
                if (before === mark && after === mark) {
                    return {
                        changes: [
                            { from: r.from - mark.length, to: r.from },
                            { from: r.to, to: r.to + mark.length },
                        ],
                        range: E.EditorSelection.range(r.from - mark.length, r.to - mark.length),
                    };
                }
                return {
                    changes: [
                        { from: r.from, insert: mark },
                        { from: r.to, insert: mark },
                    ],
                    range: E.EditorSelection.range(r.from + mark.length, r.to + mark.length),
                };
            }),
            { userEvent: 'input.format' }
        );
        return true;
    };

    const linkAt = (pos) => {
        let found = null;
        E.syntaxTree(view.state).iterate({
            from: pos,
            to: pos,
            enter: (n) => {
                if (n.name !== 'Link') return;
                const url = n.node.getChild('URL'),
                    marks = n.node.getChildren('LinkMark');
                if (marks.length >= 2)
                    found = {
                        from: n.from,
                        to: n.to,
                        label: view.state.sliceDoc(marks[0].to, marks[1].from),
                        href: url ? view.state.sliceDoc(url.from, url.to) : '',
                    };
            },
        });
        return found;
    };

    const editLink = () => {
        if (!view || readOnly) return;
        const sel = view.state.selection.main;
        const at = linkAt(sel.head);
        const words = at ? at.label : view.state.sliceDoc(sel.from, sel.to);
        // If the text changes while the dialog is open (another note, a reload), its positions are stale.
        const asked = view.state.doc,
            askedView = view;
        ui.dialog({
            title: at ? 'Edit Link' : 'Add Link',
            confirmLabel: at ? 'Save' : 'Add',
            fields: [
                { key: 'text', label: 'Text', value: words, placeholder: 'Shown in the note' },
                {
                    key: 'url',
                    label: 'Address',
                    value: at ? at.href : noteLinkTarget(words).kind === 'address' ? words : '',
                    placeholder: 'https:// or Other note.md',
                },
            ],
            onConfirm: ({ text = '', url = '' }) => {
                if (view !== askedView || view.state.doc !== asked || readOnly) return;
                let href = url.trim();
                if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !/\.md$/i.test(href)) href = 'https://' + href;
                const label = text.trim() || href;
                const from = at ? at.from : sel.from,
                    to = at ? at.to : sel.to;
                const insert = href ? `[${label.replace(/[[\]]/g, '\\$&')}](${linkAddress(href)})` : label;
                view.dispatch({
                    changes: { from, to, insert },
                    selection: { anchor: from + insert.length },
                    userEvent: 'input.link',
                });
                view.focus();
            },
        });
    };

    const styleAt = () => {
        if (!view) return null;
        const { state } = view;
        let fenced = false;
        E.syntaxTree(state).iterate({
            from: state.selection.main.head,
            to: state.selection.main.head,
            enter: (n) => {
                if (n.name === 'FencedCode') fenced = true;
            },
        });
        if (fenced) return 'mono';
        return lineKindAt(state, state.doc.lineAt(state.selection.main.head));
    };

    const element = document.createElement('div');
    Object.assign(element.style, { flex: '1 1 auto', minHeight: '0', position: 'relative' });
    const typeface = new E.Compartment();
    const editable = new E.Compartment();
    const typeOf = ({ size, font }) =>
        E.EditorView.theme({ '.cm-scroller': { fontSize: size + 'px', fontFamily: font } });
    let type = firstType;

    const press = E.EditorView.domEventHandlers({
        mousedown(e, v) {
            if (e.button !== 0) return false;
            const box = e.target.closest?.('.sk-md-check');
            if (box) {
                e.preventDefault();
                toggleChecked(v.posAtDOM(box));
                return true;
            }
            const link = e.target.closest?.('.sk-md-link');
            const href = link?.getAttribute('data-href');
            const target = href ? noteLinkTarget(href) : { kind: 'none' };
            if (target.kind !== 'none' && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                if (target.kind === 'address') noteOpenAddress({ host, ui }, target.href);
                else onOpenNote?.(target.path);
                return true;
            }
            return false;
        },
        contextmenu(e, v) {
            const link = e.target.closest?.('.sk-md-link');
            e.preventDefault();
            onMenu?.(e, link ? link.getAttribute('data-href') : null);
            return true;
        },
    });

    // The engine's own Enter would carry an empty ">" on to the next line.
    const leaveQuote = (v) => {
        const sel = v.state.selection.main;
        if (readOnly || !sel.empty) return false;
        const l = v.state.doc.lineAt(sel.head);
        if (!/^\s*>\s*$/.test(l.text)) return false;
        v.dispatch({
            changes: { from: l.from, to: l.to, insert: '' },
            selection: { anchor: l.from },
            userEvent: 'input.format',
        });
        return true;
    };

    // Lucide icons, ISC license.
    const SHAPE = {
        heading: `<path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/>`,
        checklist: `<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>`,
        bullet: `<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>`,
        number: `<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>`,
        quote: `<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>`,
        code: `<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>`,
        divider: `<path d="M5 12h14"/>`,
        link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
        date: `<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>`,
        bold: `<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>`,
        italic: `<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>`,
        strike: `<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>`,
    };
    const shape = (name, size = 15) =>
        `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${SHAPE[name] || ''}</svg>`;

    const SLASH = () => [
        {
            label: 'Title',
            aliases: ['heading 1', 'h1', '제목'],
            icon: 'heading',
            hint: '#',
            run: () => format('title'),
        },
        {
            label: 'Heading',
            aliases: ['heading 2', 'h2', '소제목'],
            icon: 'heading',
            hint: '##',
            run: () => format('heading'),
        },
        {
            label: 'Subheading',
            aliases: ['heading 3', 'h3'],
            icon: 'heading',
            hint: '###',
            run: () => format('subheading'),
        },
        {
            label: 'Checklist',
            aliases: ['todo', 'task', 'checkbox', '체크', '할일'],
            icon: 'checklist',
            hint: '[ ]',
            run: () => format('check'),
        },
        {
            label: 'Bulleted List',
            aliases: ['bullet', 'unordered', '목록'],
            icon: 'bullet',
            hint: '-',
            run: () => format('bullet'),
        },
        {
            label: 'Numbered List',
            aliases: ['number', 'ordered', '번호'],
            icon: 'number',
            hint: '1.',
            run: () => format('number'),
        },
        { label: 'Quote', aliases: ['blockquote', '인용'], icon: 'quote', hint: '>', run: () => format('quote') },
        {
            label: 'Code Block',
            aliases: ['code', 'monospaced', 'fence', '코드'],
            icon: 'code',
            hint: '```',
            run: () => format('mono'),
        },
        {
            label: 'Divider',
            aliases: ['rule', 'line', 'hr', '구분선'],
            icon: 'divider',
            hint: '---',
            run: () => insertDivider(),
        },
        { label: 'Link…', aliases: ['url', 'address', '링크'], icon: 'link', hint: '⌘K', run: () => editLink() },
        {
            label: "Today's Date",
            aliases: ['date', 'today', '날짜', '오늘'],
            icon: 'date',
            run: () => insertText(noteToday()),
        },
    ];
    const insertText = (text) => {
        const sel = view.state.selection.main;
        view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: text },
            selection: { anchor: sel.from + text.length },
            userEvent: 'input',
        });
    };
    // An empty line above it: "---" right under a paragraph makes that paragraph a heading, not a rule.
    const insertDivider = () => {
        const { state } = view;
        const l = state.doc.lineAt(state.selection.main.head);
        const empty = !l.text.trim();
        const above = empty ? (l.number > 1 ? state.doc.line(l.number - 1).text : '') : l.text;
        const insert = (empty ? '' : '\n') + (above.trim() ? '\n' : '') + '---\n';
        const from = empty ? l.from : l.to;
        view.dispatch({
            changes: { from, to: empty ? l.to : from, insert },
            selection: { anchor: from + insert.length },
            userEvent: 'input',
        });
    };
    // The editor keeps the keyboard and steers the suggestions.
    let slash = null; // { from } while the menu is open
    const suggest = ui.suggestions({ onPick: (it) => takeSlash(it) });
    const closeSlash = () => {
        slash = null;
        suggest.close();
    };
    // Each name is matched on its own: joined, a short alias would be scored as the start of a long string.
    const slashMatches = (query) => {
        const best = (it) =>
            [it.label, ...(it.aliases || [])]
                .map((text) => match(text, query))
                .filter(Boolean)
                .sort((a, b) => b.tier - a.tier || b.score - a.score)[0] || null;
        const found = !query
            ? SLASH()
            : SLASH()
                  .map((it, i) => ({ it, i, m: best(it) }))
                  .filter((x) => x.m)
                  .sort((a, b) => b.m.tier - a.m.tier || b.m.score - a.m.score || a.i - b.i)
                  .map((x) => x.it);
        return found.map((it) => ({ ...it, icon: /^\s*<svg/.test(it.icon || '') ? it.icon : shape(it.icon) }));
    };
    const placeSlash = () => {
        const at = view.coordsAtPos(slash.from);
        if (!at) closeSlash();
        else suggest.place(at);
    };
    const takeSlash = (it) => {
        if (!slash) return;
        const from = slash.from,
            to = view.state.selection.main.head;
        closeSlash();
        view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from }, userEvent: 'delete' });
        it.run();
    };
    const followSlash = (u) => {
        if (readOnly || !u.view.hasFocus) {
            if (slash) closeSlash();
            return;
        }
        const { state } = u;
        const head = state.selection.main.head;
        if (slash && u.docChanged) slash.from = u.changes.mapPos(slash.from, -1);
        else if (
            !slash &&
            u.docChanged &&
            state.selection.main.empty &&
            state.sliceDoc(head - 1, head) === '/' &&
            u.transactions.some((tr) => tr.isUserEvent('input.type'))
        ) {
            const before = state.sliceDoc(head - 2, head - 1);
            if (head - 1 === state.doc.lineAt(head).from || /\s/.test(before)) slash = { from: head - 1 };
        }
        if (!slash) return;
        if (inCode(state, slash.from)) return closeSlash();
        const line = state.doc.lineAt(slash.from);
        const query = head > slash.from ? state.sliceDoc(slash.from + 1, head) : null;
        if (
            query == null ||
            state.sliceDoc(slash.from, slash.from + 1) !== '/' ||
            head > line.to ||
            /\s/.test(query) ||
            !state.selection.main.empty
        )
            return closeSlash();
        const items = slashMatches(query);
        if (!items.length) return closeSlash();
        const at = view.coordsAtPos(slash.from);
        if (!at) return closeSlash();
        suggest.show(items, at);
    };
    const slashKey = (step) => () => {
        if (!slash) return false;
        if (step === 'take') suggest.take();
        else if (step === 'close') closeSlash();
        else suggest.step(step);
        return true;
    };

    const bar = ui.floatingBar();
    for (const [name, title, run] of [
        ['bold', 'Bold (⌘B)', () => wrap('**')(view)],
        ['italic', 'Italic (⌘I)', () => wrap('*')(view)],
        ['strike', 'Strikethrough (⇧⌘X)', () => wrap('~~')(view)],
        ['code', 'Code (⌘E)', () => wrap('`')(view)],
        ['link', 'Link (⌘K)', () => editLink()],
    ]) {
        const b = ui.iconBtn(
            shape(name, 15),
            title,
            () => {
                run();
                view?.focus();
            },
            { size: 'sm' }
        );
        bar.appendChild(b);
    }
    const followBar = () => {
        const sel = view?.state.selection.main;
        const show =
            !!view &&
            view.hasFocus &&
            !readOnly &&
            !slash &&
            sel &&
            !sel.empty &&
            view.state.doc.lineAt(sel.from).number === view.state.doc.lineAt(sel.to).number;
        if (!show) {
            bar.style.display = 'none';
            return;
        }
        const a = view.coordsAtPos(sel.from),
            b = view.coordsAtPos(sel.to);
        if (!a || !b) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        const w = bar.offsetWidth,
            h = bar.offsetHeight;
        const mid = (a.left + b.right) / 2;
        bar.style.left = Math.max(8, Math.min(mid - w / 2, window.innerWidth - w - 8)) + 'px';
        bar.style.top = (a.top - h - 8 > 8 ? a.top - h - 8 : b.bottom + 8) + 'px';
    };
    // Captured, so a scroll in any inner scroller moves the floating menu and bar too.
    element.addEventListener(
        'scroll',
        () => {
            if (slash) placeSlash();
            followBar();
        },
        true
    );
    const hideFloats = () => {
        closeSlash();
        bar.style.display = 'none';
    };

    // Highest, to beat the Markdown keymap, which the engine puts at high precedence itself.
    const keys = E.Prec.highest(
        E.keymap.of([
            { key: 'ArrowDown', run: slashKey(1) },
            { key: 'ArrowUp', run: slashKey(-1) },
            { key: 'Enter', run: (v) => slashKey('take')() || leaveQuote(v) },
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
            { key: 'Tab', run: E.indentMore, shift: E.indentLess },
        ])
    );

    const listener = E.EditorView.updateListener.of((u) => {
        // Opening or replacing a note sets a new state, which is not a docChanged update.
        if (u.docChanged) onChange?.();
        followSlash(u);
        if (u.docChanged || u.selectionSet || u.focusChanged || u.geometryChanged) followBar();
    });

    const lock = (ro) => [E.EditorView.editable.of(!ro), E.EditorState.readOnly.of(ro)];
    const open = ({ text = '', readOnly: ro = false, at = 0 } = {}) => {
        readOnly = ro;
        const state = E.EditorState.create({
            doc: text,
            selection: { anchor: Math.max(0, Math.min(at, text.length)) },
            extensions: [
                E.history(),
                E.drawSelection(),
                E.dropCursor(),
                E.EditorView.lineWrapping,
                E.indentUnit.of('  '),
                E.markdown({ base: E.markdownLanguage, codeLanguages: E.codeLanguages }),
                keys,
                E.keymap.of([...E.defaultKeymap, ...E.historyKeymap]),
                E.syntaxHighlighting(highlight),
                look,
                typeface.of(typeOf(type)),
                preview,
                press,
                listener,
                E.placeholder('Start writing\u2026'),
                editable.of(lock(ro)),
                // Blocks every change while read-only, including commands that ignore the read-only facet.
                E.EditorState.transactionFilter.of((tr) => (readOnly && tr.docChanged ? [] : tr)),
            ],
        });
        hideFloats();
        if (view) view.setState(state);
        else {
            view = new E.EditorView({ state, parent: element });
            /* The engine ignores presses in the scroller's side margins, so one there is replayed at the
         nearest edge of the text, keeping drags, double and triple clicks and shift-extend. */
            view.scrollDOM.addEventListener('mousedown', (ev) => {
                if (ev.target !== view.scrollDOM || !ev.isTrusted) return;
                const box = view.contentDOM.getBoundingClientRect();
                ev.preventDefault();
                ev.stopPropagation();
                view.contentDOM.dispatchEvent(
                    new MouseEvent('mousedown', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        detail: ev.detail,
                        button: ev.button,
                        buttons: ev.buttons,
                        clientX: Math.min(Math.max(ev.clientX, box.left + 1), box.right - 1),
                        clientY: ev.clientY,
                        shiftKey: ev.shiftKey,
                        altKey: ev.altKey,
                        metaKey: ev.metaKey,
                        ctrlKey: ev.ctrlKey,
                    })
                );
            });
        }
        view.scrollDOM.scrollTop = 0;
    };
    // A fresh state, not an edit: the old undo history replayed over the new text would corrupt it.
    const replace = (text) => {
        if (!view) return;
        const head = view.state.selection.main.head,
            scroll = view.scrollDOM.scrollTop;
        open({ text, readOnly, at: head });
        view.scrollDOM.scrollTop = scroll;
    };
    const setReadOnly = (ro) => {
        readOnly = !!ro;
        view?.dispatch({ effects: editable.reconfigure(lock(readOnly)) });
    };
    const close = () => {
        hideFloats();
        view?.destroy();
        view = null;
    };

    const focus = ({ end = false } = {}) => {
        if (!view) return;
        view.focus();
        if (end) view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
    };

    return {
        element,
        open,
        replace,
        close,
        focus,
        format,
        editLink,
        styleAt,
        setReadOnly,
        toggleChecked: () => toggleChecked(),
        text: () => (view ? view.state.doc.toString() : ''),
        isOpen: () => !!view,
        hasFocus: () => !!view && view.hasFocus,
        selectionText: () =>
            view ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) : '',
        setType: (next) => {
            type = next;
            view?.dispatch({ effects: typeface.reconfigure(typeOf(next)) });
        },
    };
};
