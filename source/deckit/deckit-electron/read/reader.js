// What reads a document as a person does, run in deckit's world of every page as each of its documents starts: its
// roles, names, states, text and places, from the elements and their ARIA attributes as the page drew them, each
// place where its element stands, measured, whatever moves. It numbers each element it answers once, the
// number kept while the element lives, keeps the last of its counts each number changed at, and, as each count is
// sealed, which elements its reading has. `install` is run as written, so it reaches nothing outside itself.
function install() {
    if (globalThis.deckitReader) return;
    const FRAME = 16; // ms
    const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const numbers = new WeakMap(); // element -> its number
    const elements = new Map(); // number -> WeakRef of its element
    const dropped = new FinalizationRegistry((number) => elements.delete(number));
    let next = 1;
    let count = 0; // goes up as what changed is sealed
    const changed = new Map(); // number -> the last count it changed at, 0 the document itself
    const open = new Set(); // the numbers changed since the last count, 0 the document itself
    // element -> the counts its line came into the document's reading and left it at, in turn, each as it was sealed
    const sight = new WeakMap();
    let inSight = new Set(); // the elements whose lines the reading had as the last count was sealed
    let timer = null;
    let moves = null; // while a reading runs, how each element a motion draws elsewhere stands at rest

    const INPUT = {
        checkbox: 'checkbox',
        radio: 'radio',
        range: 'slider',
        button: 'button',
        submit: 'button',
        reset: 'button',
        file: 'button',
        color: 'button',
        image: 'button',
        search: 'searchbox',
        number: 'spinbutton',
        hidden: null,
    };
    const labelled = (el) => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
    const TAG = {
        A: (el) => (el.hasAttribute('href') ? 'link' : null),
        BUTTON: 'button',
        SUMMARY: 'button',
        TEXTAREA: 'textbox',
        SELECT: (el) => (el.multiple || el.size > 1 ? 'listbox' : 'combobox'),
        INPUT: (el) => (el.type in INPUT ? INPUT[el.type] : 'textbox'),
        NAV: 'navigation',
        MAIN: 'main',
        HEADER: 'banner',
        FOOTER: 'contentinfo',
        ASIDE: 'complementary',
        FORM: (el) => (labelled(el) ? 'form' : null),
        SECTION: (el) => (labelled(el) ? 'region' : null),
        ARTICLE: 'article',
        H1: 'heading',
        H2: 'heading',
        H3: 'heading',
        H4: 'heading',
        H5: 'heading',
        H6: 'heading',
        UL: 'list',
        OL: 'list',
        LI: 'listitem',
        TABLE: 'table',
        TR: 'row',
        TD: 'cell',
        TH: 'columnheader',
        IMG: (el) => (el.getAttribute('alt') === '' ? null : 'img'),
        DIALOG: 'dialog',
        PROGRESS: 'progressbar',
        METER: 'meter',
        OPTION: 'option',
        DETAILS: 'group',
        FIELDSET: 'group',
        OUTPUT: 'status',
        IFRAME: 'document',
    };
    const ITEM = new Set(
        'listitem row option treeitem tab menuitem menuitemcheckbox menuitemradio cell gridcell columnheader rowheader'.split(
            ' '
        )
    );
    const FROM_CONTENT = new Set(
        'button link heading tab menuitem menuitemcheckbox menuitemradio option treeitem checkbox radio switch cell gridcell columnheader rowheader listitem row tooltip status alert'.split(
            ' '
        )
    );
    const FIELD = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);
    const INLINE = 'a[href],button,input,select,textarea,[role],[tabindex],[contenteditable]';

    const numberOf = (el) => {
        let number = numbers.get(el);
        if (number) return number;
        number = next++;
        numbers.set(el, number);
        elements.set(number, new WeakRef(el));
        dropped.register(el, number);
        return number;
    };
    const elementOf = (number) => {
        const el = elements.get(number)?.deref();
        return el?.isConnected ? el : null;
    };
    const roleOf = (el) => {
        const given = el.getAttribute('role');
        if (given) return given === 'presentation' || given === 'none' ? null : given.trim().split(/\s+/)[0];
        const tag = TAG[el.nodeName];
        if (tag) return typeof tag === 'function' ? tag(el) : tag;
        if (el.isContentEditable && !el.parentElement?.isContentEditable) return 'textbox';
        return null;
    };
    const flat = (text) =>
        String(text ?? '')
            .replace(/\s+/g, ' ')
            .trim();
    // `text` as one line, its head alone past `most`: `[head, length]`, the length given only where it was cut.
    const cut = (text, most) => {
        const whole = flat(text);
        return whole.length > most ? [whole.slice(0, most), whole.length] : [whole, undefined];
    };
    const nameOf = (el, role) => {
        const by = el.getAttribute('aria-labelledby');
        if (by) {
            const root = el.getRootNode();
            const text = flat(
                by
                    .split(/\s+/)
                    .map((id) => root.getElementById?.(id)?.textContent ?? '')
                    .join(' ')
            );
            if (text) return text;
        }
        const label = flat(el.getAttribute('aria-label'));
        if (label) return label;
        if (el.labels?.length) return flat(el.labels[0].textContent);
        const alt = flat(el.getAttribute('alt'));
        if (alt) return alt;
        if (FROM_CONTENT.has(role)) {
            const text = flat(el.textContent);
            if (text) return text;
        }
        return flat(el.getAttribute('title') || el.getAttribute('placeholder'));
    };
    const statesOf = (el, role, most) => {
        const out = [];
        const aria = (name) => el.getAttribute('aria-' + name);
        if (el.disabled || aria('disabled') === 'true') out.push('disabled');
        if (role === 'checkbox' || role === 'radio' || role === 'switch' || role.startsWith('menuitem')) {
            const checked = el.checked ?? aria('checked') === 'true';
            out.push(aria('checked') === 'mixed' ? 'mixed' : checked ? 'checked' : 'unchecked');
        }
        for (const name of ['pressed', 'expanded', 'selected', 'current', 'invalid', 'busy', 'haspopup']) {
            const value = aria(name);
            if (value && value !== 'false') out.push(value === 'true' ? name : `${name}=${value}`);
            else if (value === 'false' && (name === 'expanded' || name === 'pressed')) out.push(`not ${name}`);
        }
        if (el.required) out.push('required');
        if (el.readOnly) out.push('readonly');
        if (role === 'heading') out.push(`level ${aria('level') || el.nodeName.slice(1)}`);
        if (el === document.activeElement) out.push('focused');
        if (FIELD.has(role)) {
            if (typeof el.value !== 'string') {
                if (el.isContentEditable) out.push(`text ${el.textContent.length}`);
            } else if (el.type === 'password') out.push(`text ${el.value.length}`);
            else {
                const [head, length] = cut(el.value, most);
                out.push(`value ${JSON.stringify(`${head}${length ? '…' : ''}`)}${length ? ` (${length})` : ''}`);
            }
        }
        return out;
    };
    // An element's own line, `level` deep: `{ depth, role, name, length, states, number, element }`.
    const lineOf = (el, role, level, { text }) => {
        const [name, length] = cut(nameOf(el, role), text);
        const line = {
            depth: level,
            role,
            states: statesOf(el, role, Math.min(text, 40)),
            number: numberOf(el),
            element: el,
        };
        if (name) line.name = name;
        if (length) line.length = length;
        return line;
    };
    const childrenOf = (el) => (el.shadowRoot ? el.shadowRoot.children : el.children);
    // An element that only passes its children on to its parent's layout draws no box of its own and is still shown.
    const shown = (el) =>
        !el.checkVisibility ||
        el.checkVisibility({ visibilityProperty: true }) ||
        getComputedStyle(el).display === 'contents';
    const within = (rect, clip) =>
        rect.right > clip.left && rect.left < clip.right && rect.bottom > clip.top && rect.top < clip.bottom;
    const scrolls = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    const clipOf = (el, rect, clip) =>
        scrolls(el)
            ? {
                  left: Math.max(clip.left, rect.left),
                  top: Math.max(clip.top, rect.top),
                  right: Math.min(clip.right, rect.right),
                  bottom: Math.min(clip.bottom, rect.bottom),
              }
            : clip;
    const view = () => ({ left: 0, top: 0, right: innerWidth, bottom: innerHeight });
    // What an element's ancestors that scroll leave of the page to see it in.
    const clipAround = (el) => {
        let clip = view();
        for (let at = el.parentElement; at; at = at.parentElement) if (scrolls(at)) clip = clipOf(at, placed(at), clip);
        return clip;
    };
    const rectOf = (rect) => ({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    });

    // The lines under `root`, itself included, each element with a role a line, in the document's order. With
    // `detail`, text outside any role is a line of role `text`, `{ depth, role, name, length, element }`. An element
    // `keep` does not take is a line of its role and element alone, unnumbered.
    function read(root, { all = false, depth = 30, items = 30, text = 80, roles = null, detail = false, keep } = {}) {
        const out = [];
        const walk = (el, level, clip, counter) => {
            if (el.getAttribute('aria-hidden') === 'true' || el.nodeName === 'SCRIPT' || el.nodeName === 'STYLE')
                return;
            const role = roleOf(el);
            const item = role && ITEM.has(role) && counter;
            if (!all) {
                if (!shown(el)) return;
                const rect = placed(el);
                const drawn = rect.width > 0 || rect.height > 0;
                if (drawn && !within(rect, clip)) {
                    if (item) counter.items++;
                    return;
                }
                if (drawn) clip = clipOf(el, rect, clip);
            }
            let line = null;
            // The root of a node's reading is its first line with a role or none, what it holds one level under it.
            let below = detail && el === root ? level + 1 : level;
            let mine = counter;
            if (role) {
                if (item) {
                    counter.items++;
                    counter.listed++;
                    if (counter.listed > items) return;
                }
                if (level > depth) return;
                line = !keep || keep(el) ? lineOf(el, role, level, { text }) : { depth: level, role, element: el };
                out.push(line);
                if (level === depth) {
                    const under = el.querySelectorAll('*').length;
                    if (under) line.below = under;
                    return;
                }
                if ((role === 'textbox' || role === 'searchbox') && !(detail && el === root)) return;
                below = level + 1;
                mine = { items: 0, listed: 0 };
            }
            // Text an element holds itself, where it is not the name its role takes from what it holds.
            if (detail && !(line && el !== root && FROM_CONTENT.has(role))) {
                let direct = '';
                for (const node of el.childNodes) if (node.nodeType === 3) direct += node.nodeValue;
                if (direct.trim()) {
                    const nested = el.querySelector(INLINE);
                    const [name, length] = cut(nested ? direct : el.textContent, text);
                    out.push({ depth: below, role: 'text', name, ...(length ? { length } : {}), element: el });
                    if (!nested) return;
                }
            }
            for (const child of childrenOf(el)) walk(child, below, clip, mine);
            if (line && mine.items) {
                line.items = mine.items;
                if (!all) line.inView = Math.min(mine.listed, mine.items);
            }
        };
        walk(root, 0, all || root === document.documentElement ? view() : clipAround(root), null);
        return roles ? holding(out, new Set(roles)) : out;
    }

    // The lines of `roles` alone, and those that hold them.
    function holding(lines, roles) {
        const kept = new Set();
        const above = []; // the line last seen at each depth
        lines.forEach((line, at) => {
            above[line.depth] = at;
            if (!roles.has(line.role)) return;
            for (let depth = 0; depth <= line.depth; depth++) if (above[depth] !== undefined) kept.add(above[depth]);
        });
        return lines.filter((_line, at) => kept.has(at));
    }

    // A line as it is answered, without what only the reader holds.
    const plain = ({ element: _element, ...line }) => line;

    // How a field of one line draws its text: `at(offset)`, the x in the page of the place before the character at
    // `offset` of its value, measured from the text before it, and `y`, `height`, `left`, `right` of the box the text
    // is drawn in.
    function drawnIn(el) {
        const style = getComputedStyle(el);
        const pen = (drawnIn.canvas ??= document.createElement('canvas')).getContext('2d');
        pen.font = style.font;
        pen.letterSpacing = style.letterSpacing;
        const drawn = el.type === 'password' ? '\u2022'.repeat(el.value.length) : el.value;
        const rect = placed(el);
        const left = rect.x + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
        const top = parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
        const bottom = parseFloat(style.borderBottomWidth) + parseFloat(style.paddingBottom);
        return {
            at: (offset) => left + pen.measureText(drawn.slice(0, offset)).width - el.scrollLeft,
            y: rect.y + top,
            height: rect.height - top - bottom,
            left,
            right: rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        };
    }

    const focusIn = (el) => el === document.activeElement || el.contains(document.activeElement);

    // Where the caret of a field with the document's focus is drawn, a rect in the page, or null: read from the
    // selection in editable content, and measured from the text before it in a field of one line.
    function caretOf(el) {
        if (!focusIn(el)) return null;
        if (typeof el.selectionEnd === 'number' && el.nodeName === 'INPUT') {
            const { at, y, height } = drawnIn(el);
            return rectOf({ x: at(el.selectionEnd), y, width: 1, height });
        }
        const selection = getSelection();
        if (!selection.rangeCount || !el.contains(selection.focusNode)) return null;
        const range = document.createRange();
        range.setStart(selection.focusNode, selection.focusOffset);
        const holder = selection.focusNode.nodeType === 1 ? selection.focusNode : selection.focusNode.parentElement;
        const drawn = range.getClientRects()[0];
        if (drawn) {
            const { x, y, height } = restOf(holder, drawn);
            return rectOf({ x, y, width: 1, height });
        }
        const rect = holder && placed(holder);
        return rect ? rectOf({ x: rect.x, y: rect.y, width: 1, height: rect.height }) : null;
    }

    // Where what is selected in a field with the document's focus is drawn, rects in the page, one a line of text,
    // top to bottom, each cut to what shows of the field; none where nothing is selected. Measured in a field of one
    // line, and read from the selection's text in editable content.
    function selectedOf(el) {
        if (!focusIn(el)) return [];
        const box = placed(el);
        if (typeof el.selectionEnd === 'number' && el.nodeName === 'INPUT') {
            if (el.selectionStart === el.selectionEnd) return [];
            const { at, y, height, left, right } = drawnIn(el);
            const from = Math.max(left, at(el.selectionStart));
            const to = Math.min(right, at(el.selectionEnd));
            return to > from ? [rectOf({ x: from, y, width: to - from, height })] : [];
        }
        const selection = getSelection();
        if (!selection.rangeCount || selection.isCollapsed || !el.contains(selection.focusNode)) return [];
        const whole = selection.getRangeAt(0);
        const walker = document.createTreeWalker(whole.commonAncestorContainer, NodeFilter.SHOW_TEXT);
        const rows = []; // { left, right, top, bottom }, one a line of text
        const texts = whole.commonAncestorContainer.nodeType === 3 ? [whole.commonAncestorContainer] : [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        for (const text of texts) {
            if (!whole.intersectsNode(text)) continue;
            const part = document.createRange();
            part.setStart(text, text === whole.startContainer ? whole.startOffset : 0);
            part.setEnd(text, text === whole.endContainer ? whole.endOffset : text.length);
            for (const drawn of [...part.getClientRects()].map((each) => restOf(text.parentElement, each))) {
                const cut = {
                    left: Math.max(drawn.left, box.left),
                    right: Math.min(drawn.right, box.right),
                    top: Math.max(drawn.top, box.top),
                    bottom: Math.min(drawn.bottom, box.bottom),
                };
                if (cut.right <= cut.left || cut.bottom <= cut.top) continue;
                // A rect is of the line that holds its middle.
                const middle = (cut.top + cut.bottom) / 2;
                const row = rows.find((each) => middle > each.top && middle < each.bottom);
                if (!row) rows.push(cut);
                else
                    Object.assign(row, {
                        left: Math.min(row.left, cut.left),
                        right: Math.max(row.right, cut.right),
                        top: Math.min(row.top, cut.top),
                        bottom: Math.max(row.bottom, cut.bottom),
                    });
            }
        }
        return rows
            .sort((one, other) => one.top - other.top)
            .map((row) =>
                rectOf({ x: row.left, y: row.top, width: row.right - row.left, height: row.bottom - row.top })
            );
    }

    // What is selected in a field: `{ start, end }`, counted in its value, or, in editable content, `{ line, column,
    // length }`, the text line of `lines` the selection ends in, counted from 1, how far into it, and how much text
    // is selected.
    function selectionOf(el, lines) {
        if (typeof el.selectionStart === 'number') return { start: el.selectionStart, end: el.selectionEnd };
        const selection = getSelection();
        if (!selection.rangeCount || !el.contains(selection.focusNode)) return null;
        const texts = lines.filter((line) => line.role === 'text');
        const at = texts.findIndex((line) => line.element.contains(selection.focusNode));
        if (at < 0) return { length: selection.toString().length };
        const before = document.createRange();
        before.selectNodeContents(texts[at].element);
        before.setEnd(selection.focusNode, selection.focusOffset);
        return { line: at + 1, column: before.toString().length, length: selection.toString().length };
    }

    // MARK: - Where a thing stands
    // What says how an element is drawn, in the order the engine composes them about its transform origin.
    const DRAWN = ['translate', 'rotate', 'scale', 'transform'];
    // An element of HTML told by its namespace: one made by another document keeps that document's prototypes.
    const HTML = 'http://www.w3.org/1999/xhtml';

    // `reading` run knowing which elements a motion of how they are drawn moves, each rect read where it stands once
    // those motions end: a reading tells where a thing stands, not where it is drawn this frame, and writes nothing
    // into what it reads. A motion of what lays an element out is read as laid now; one that never ends, as drawn.
    function standing(reading) {
        if (moves) return reading();
        moves = movesOf();
        try {
            return reading();
        } finally {
            moves = null;
        }
    }

    // `{ ends, above, rests }`: for each element a motion under way draws, the value each property of `DRAWN` it moves
    // ends at, null where it is read as drawn; and, filled as a reading asks, each element's movers from itself up and
    // each mover's rest.
    function movesOf() {
        const ends = new Map();
        for (const animation of document.getAnimations()) {
            const { effect } = animation;
            const target = effect?.target;
            if (!target || effect.pseudoElement || animation.playState !== 'running') continue;
            const frames = effect.getKeyframes();
            const moved = DRAWN.filter((property) => frames.some((frame) => property in frame));
            if (!moved.length) continue;
            const end = endOf(animation);
            const own = ends.get(target) ?? ends.set(target, {}).get(target);
            for (const property of moved)
                if (own[property] !== null)
                    own[property] = end === null ? null : valueAt(frames, property, end, target);
        }
        return { ends, above: new Map(), rests: new Map() };
    }

    // The directed progress, 0 or 1, an animation's effect ends at by its timing and the way it plays; null where it
    // never ends or ends between its first keyframe and its last.
    function endOf(animation) {
        const { iterations, iterationStart, direction } = animation.effect.getTiming();
        if (!Number.isFinite(iterations)) return null;
        const back = animation.playbackRate < 0;
        const through = back ? iterationStart : iterationStart + iterations;
        const index = back || through === 0 ? Math.floor(through) : Math.ceil(through) - 1;
        const odd = index % 2 === 1;
        const turned =
            direction === 'reverse' ||
            (direction === 'alternate' && odd) ||
            (direction === 'alternate-reverse' && !odd);
        const progress = turned ? 1 - (through - index) : through - index;
        return progress === 0 || progress === 1 ? progress : null;
    }

    // A property's value at the keyframe `progress` falls on; an implicit one is the element's own declared value,
    // and null, read as drawn, where it declares none.
    function valueAt(frames, property, progress, el) {
        const at = frames.filter((frame) => frame.computedOffset === progress && property in frame);
        const frame = progress === 1 ? at.at(-1) : at[0];
        return frame ? frame[property] : el.style?.getPropertyValue(property) || null;
    }

    // A value of a property of `DRAWN` as a transform function, a percentage of a translation taken of `box`.
    function functionOf(property, value, box) {
        const parts = value.trim().split(/\s+/);
        const of = (part, at) =>
            part.endsWith('%') ? `${(parseFloat(part) / 100) * [box.width, box.height][at]}px` : part;
        if (property === 'translate') {
            const [x, y = '0px', z = '0px'] = parts.map(of);
            return `translate3d(${x}, ${y}, ${z})`;
        }
        if (property === 'scale') {
            const [x, y = x, z = '1'] = parts.map((part) => (part.endsWith('%') ? `${parseFloat(part) / 100}` : part));
            return `scale3d(${x}, ${y}, ${z})`;
        }
        if (property === 'rotate') {
            if (parts.length === 1) return `rotate(${value})`;
            if (parts.length === 4) return `rotate3d(${parts.join(', ')})`;
            return `rotate3d(${{ x: '1, 0, 0', y: '0, 1, 0', z: '0, 0, 1' }[parts[0]]}, ${parts[1]})`;
        }
        return value;
    }

    // How an element of `box` is drawn in its own box's space, each property of `DRAWN` its `valueOf`, composed about
    // `origin`; null where a value is not one a matrix is made of here.
    function matrixOf(valueOf, origin, box) {
        try {
            let matrix = new DOMMatrix().translate(...origin);
            for (const property of DRAWN) {
                const value = valueOf(property);
                if (value && value !== 'none')
                    matrix = matrix.multiply(new DOMMatrix(functionOf(property, value, box)));
            }
            return matrix.translate(-origin[0], -origin[1], -origin[2]);
        } catch {
            return null;
        }
    }

    const bounds = (points) => {
        const xs = points.map((point) => point.x / point.w);
        const ys = points.map((point) => point.y / point.w);
        const [left, top] = [Math.min(...xs), Math.min(...ys)];
        return new DOMRect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
    };
    const cornersOf = ({ x = 0, y = 0, width, height }, matrix) =>
        [
            [x, y],
            [x + width, y],
            [x, y + height],
            [x + width, y + height],
        ].map(([left, top]) => new DOMPoint(left, top).matrixTransform(matrix));

    // A mover's rest: `own`, its rect at rest, and `matrix`, what takes a point drawn under it to where it stands
    // once its motion ends, null where that is not known; null where its rest is not measured.
    function restingOf(el) {
        if (moves.rests.has(el)) return moves.rests.get(el);
        let rest = null;
        const style = getComputedStyle(el);
        const ends = moves.ends.get(el);
        const sum = (...parts) => parts.reduce((total, part) => total + parseFloat(style[part]), 0);
        const box =
            el.namespaceURI === HTML && style.width.endsWith('px') && style.height.endsWith('px')
                ? style.boxSizing === 'border-box'
                    ? { width: sum('width'), height: sum('height') }
                    : {
                          width: sum('width', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'),
                          height: sum('height', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'),
                      }
                : null;
        const origin = style.transformOrigin.split(' ').map(parseFloat);
        while (origin.length < 3) origin.push(0);
        const drawn = box && matrixOf((property) => style[property], origin, box);
        const still = box && matrixOf((property) => ends[property] ?? style[property], origin, box);
        if (drawn && still) {
            const from = bounds(cornersOf(box, drawn));
            const now = el.getBoundingClientRect();
            const [across, down] = [
                from.width ? now.width / from.width : 1,
                from.height ? now.height / from.height : 1,
            ];
            const page = new DOMMatrix()
                .translate(now.x - across * from.x, now.y - down * from.y)
                .scale(across, down, 1);
            const matrix = page.multiply(still).multiply(drawn.inverse()).multiply(page.inverse());
            rest = {
                own: bounds(cornersOf(box, page.multiply(still))),
                matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)
                    ? matrix
                    : null,
            };
        }
        moves.rests.set(el, rest);
        return rest;
    }

    // The elements from `el` up, in the flat tree, a motion of how they are drawn moves, innermost first.
    const moversOf = (el) => {
        if (!el) return [];
        if (moves.above.has(el)) return moves.above.get(el);
        const up = moversOf(el.assignedSlot ?? el.parentElement ?? el.parentNode?.host);
        const all = moves.ends.has(el) ? [el, ...up] : up;
        moves.above.set(el, all);
        return all;
    };

    // A rect drawn of `el` or of what it holds, where it stands: taken, by each mover from `el` up, innermost first,
    // to where that mover's motion ends.
    function restOf(el, rect) {
        if (!moves?.ends.size) return rect;
        for (const mover of moversOf(el)) {
            const rest = restingOf(mover);
            if (!rest) continue;
            if (mover === el) rect = rest.own;
            else if (rest.matrix) rect = bounds(cornersOf(rect, rest.matrix));
        }
        return rect;
    }
    const placed = (el) => restOf(el, el.getBoundingClientRect());

    // MARK: - What changed
    const mark = (node) => {
        let number = 0;
        for (let at = node.nodeType === 1 ? node : node.parentElement; at && !number; at = at.parentElement)
            number = numbers.get(at) || 0;
        open.add(number);
        timer ??= setTimeout(seal, FRAME);
    };
    // A removed node's numbered elements, each told as changed: it reads as gone once it is asked for.
    const markRemoved = (node) => {
        if (node.nodeType !== 1) return;
        if (numbers.has(node)) open.add(numbers.get(node));
        for (const el of node.querySelectorAll('*')) if (numbers.has(el)) open.add(numbers.get(el));
    };
    // Which elements the reading has at this count, each that came into it or left it kept as doing so at it.
    const note = () => {
        const root = document.documentElement;
        const now = new Set(root ? standing(() => read(root, { keep: () => false })).map((line) => line.element) : []);
        const flip = (el) => (sight.get(el) ?? sight.set(el, []).get(el)).push(count);
        for (const el of now) if (!inSight.has(el)) flip(el);
        for (const el of inSight) if (!now.has(el)) flip(el);
        inSight = now;
    };
    // Whether an element's line was in the reading as the count `at` was sealed.
    const seenAt = (el, at) => (sight.get(el) ?? []).filter((each) => each <= at).length % 2 === 1;
    // What changed since the last count becomes the next count's, what the reading has then is kept, and deckit is
    // told the count.
    function seal() {
        clearTimeout(timer);
        timer = null;
        if (!open.size) return;
        count += 1;
        for (const number of open) changed.set(number, count);
        open.clear();
        note();
        try {
            const word = JSON.stringify({ reader: { key, count } });
            webkit.messageHandlers.deckit.postMessage(word)?.catch?.(() => {});
        } catch {
            // No one hears this document.
        }
    }
    note();
    new MutationObserver((records) => {
        for (const record of records) {
            mark(record.target);
            for (const node of record.removedNodes) markRemoved(node);
        }
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    for (const type of ['focusin', 'focusout', 'input', 'change', 'scroll'])
        document.addEventListener(type, (event) => mark(event.target), {
            capture: true,
            passive: true,
        });

    const refuse = (error) => ({ key, count, error });
    const found = (asked, number) => (asked === key ? elementOf(number) : null);

    globalThis.deckitReader = Object.freeze({
        // The document's outline: `{ key, count, width, height, lines }`.
        outline(knobs = {}) {
            const root = document.documentElement;
            const lines = root ? standing(() => read(root, knobs)).map(plain) : [];
            return { key, count, width: innerWidth, height: innerHeight, lines };
        },
        // What is under one element: its own line, its place, how far it is scrolled, its lines, text too, the first
        // `lines` of them where that is given, `more` counting the rest, what is selected in it, its caret and the
        // rects what is selected is drawn at.
        node(asked, number, knobs = {}) {
            const el = found(asked, number);
            return el ? standing(() => nodeOf(el, number, knobs)) : refuse('GONE');
        },
        // What reads otherwise since `since`, a count of this document's: `{ key, from, count, entries }`, each entry a
        // line as it reads now, `kind` `~`, a line the reading did not have at `since`, `+`, whatever brought it into
        // sight, or `{ kind: '-', number }`, an element gone.
        changes(asked, since) {
            if (asked !== key) return refuse('GONE');
            return standing(() => changesSince(since));
        },
        // An element's rect in the page, once it is scrolled into view.
        place(asked, number) {
            const el = found(asked, number);
            if (!el) return refuse('GONE');
            return standing(() => {
                el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
                return { key, count, rect: rectOf(placed(el)) };
            });
        },
    });

    // What is under one element, as `node` answers it.
    function nodeOf(el, number, { lines: most = Infinity, ...knobs }) {
        const role = roleOf(el) ?? 'generic';
        const all = read(el, { text: 200, ...knobs, detail: true });
        const own = all[0]?.number === number ? all.shift() : lineOf(el, role, 0, { text: knobs.text ?? 200 });
        const answer = { key, count, line: plain(own), rect: rectOf(placed(el)) };
        if (scrolls(el))
            answer.scroll = {
                top: el.scrollTop,
                height: el.scrollHeight,
                left: el.scrollLeft,
                width: el.scrollWidth,
            };
        let texts = 0;
        const listed = all.filter((line) => line.role !== 'text' || ++texts <= most);
        answer.lines = listed.map(plain);
        if (all.length > listed.length) answer.more = all.length - listed.length;
        if (FIELD.has(role)) {
            const selection = selectionOf(el, all);
            if (selection) answer.selection = selection;
            const caret = caretOf(el);
            if (caret) answer.caret = caret;
            const selected = selectedOf(el);
            if (selected.length) answer.selected = selected;
        }
        return answer;
    }

    // What reads otherwise since `since`, as `changes` answers it.
    function changesSince(since) {
        seal();
        if (!Number.isInteger(since) || since < 0 || since > count) return refuse('STALE');
        const numbers = [...changed].flatMap(([number, at]) => (at > since ? [number] : []));
        const entries = [];
        const came = (el) => !seenAt(el, since);
        const root = document.documentElement;
        const added = root ? read(root, { keep: came }).filter((line) => came(line.element)) : [];
        const adding = new Set(added.map((line) => line.element));
        for (const number of numbers.sort((a, b) => a - b)) {
            const el = number && elementOf(number);
            if (!number || adding.has(el)) continue;
            if (!el) {
                entries.push({ kind: '-', number });
                continue;
            }
            const [line] = read(el, { keep: (each) => each === el });
            if (line?.element === el) entries.push({ kind: '~', ...plain(line) });
            else {
                const away = lineOf(el, roleOf(el) ?? 'generic', 0, { text: 80 });
                away.states.push('not in view');
                entries.push({ kind: '~', ...plain(away) });
            }
        }
        for (const line of added) entries.push({ kind: '+', ...plain(line) });
        return { key, from: since, count, entries };
    }
}

// The reader, as a script a document runs.
export const READER = `(${install.toString()})()`;
