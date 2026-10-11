const minimap = ({ engine, theme, ui, ink }) => {
    const WIDTH = 96;
    // In pixels: a line is a 2px block and a 1px gap; a character is 1px across.
    const LINE = 3,
        BLOCK = 2,
        CHAR = 1,
        TAB = 4;
    // EDGE: how near the right edge the pointer brings it up; LINGER: milliseconds it stays after a scroll.
    const EDGE = 24,
        LINGER = 1200;
    const quiet = ui.blend(theme.contentColor, theme.contentBg, 0.45);

    const element = el('div', {
        position: 'absolute',
        right: '0',
        width: WIDTH + 'px',
        zIndex: '4',
        opacity: '0',
        pointerEvents: 'none',
        background: ui.blend(theme.contentColor, theme.contentBg, 0.04),
        borderLeft: theme.border,
        transition: `opacity ${ui.motion.fast} ${ui.motion.ease}`,
    });
    const canvas = el('canvas', { display: 'block', width: '100%', height: '100%' });
    const frame = el('div', {
        position: 'absolute',
        left: '0',
        right: '0',
        background: 'rgba(128,128,128,.18)',
        pointerEvents: 'none',
    });
    element.append(canvas, frame);

    let mode = 'scroll';
    let view = null,
        up = false,
        queued = false,
        over = false,
        lingering = null;
    // Where the frame was taken hold of, as a share of its height, so a frame resizing under the pointer stays held there.
    let grab = null;
    // To tell a vertical scroll from a sideways one.
    let lastTop = 0;

    /* Folds that overlap or touch are joined: the editor keeps an inner fold under an outer one, and
     counting both would drop its lines twice. visual and fileLine rely on ordered, disjoint ranges. */
    const foldsOf = (state) => {
        const doc = state.doc,
            out = [];
        engine.foldedRanges(state).between(0, doc.length, (from, to) => {
            const a = doc.lineAt(from).number,
                b = doc.lineAt(to).number;
            if (b <= a) return;
            const last = out[out.length - 1];
            if (last && a <= last[1]) last[1] = Math.max(last[1], b);
            else out.push([a, b]);
        });
        return out;
    };
    const visual = (n, folds) => {
        let v = n;
        for (const [a, b] of folds) {
            if (n > b) v -= b - a;
            else if (n > a) {
                v -= n - a;
                break;
            } else break;
        }
        return v;
    };
    const fileLine = (v, folds) => {
        let n = v;
        for (const [a, b] of folds) {
            if (a < n) n += b - a;
            else break;
        }
        return n;
    };

    // A shown line with a fraction (how far down that line), so wrapped lines read the same both ways.
    const lineAt = (scrollTop, folds) => {
        const doc = view.state.doc,
            h = scrollTop - view.documentPadding.top,
            b = view.lineBlockAtHeight(h);
        return visual(doc.lineAt(b.from).number, folds) + Math.max(0, Math.min(1, (h - b.top) / Math.max(1, b.height)));
    };
    const topOf = (line, folds) => {
        const doc = view.state.doc,
            v = Math.floor(line),
            n = Math.max(1, Math.min(doc.lines, fileLine(Math.max(1, v), folds)));
        const b = view.lineBlockAt(doc.line(n).from);
        return b.top + (line - v) * b.height + view.documentPadding.top;
    };

    /* All in shown lines, not scroll pixels, so the frame and the drawing agree where lines wrap.
     `r` is how far the file is scrolled, 0 at the top and 1 at the bottom. */
    const measure = () => {
        const folds = foldsOf(view.state);
        const sc = view.scrollDOM,
            height = sc.clientHeight,
            lines = visual(view.state.doc.lines, folds);
        const top = lineAt(sc.scrollTop, folds),
            onScreen = Math.max(0, lineAt(sc.scrollTop + height, folds) - top);
        const scrollable = Math.max(0, lines - onScreen);
        const r = scrollable > 0 ? Math.max(0, Math.min(1, (top - 1) / scrollable)) : 0;
        const total = lines * LINE;
        const frameHeight = Math.max(LINE, Math.min(onScreen * LINE, height));
        const travel = Math.max(0, Math.min(total, height) - frameHeight);
        return {
            folds,
            height,
            lines,
            scrollable,
            r,
            total,
            frameHeight,
            travel,
            offset: total > height ? r * (total - height) : 0,
        };
    };
    // The ends are the scroller's own, so the padding above the first line and below the last is reached.
    const scrollTo = (r, m) => {
        const sc = view.scrollDOM,
            at = Math.max(0, Math.min(1, r));
        sc.scrollTop =
            at <= 0 ? 0 : at >= 1 ? sc.scrollHeight - sc.clientHeight : topOf(1 + at * m.scrollable, m.folds);
    };

    const scrollbar = () => view.scrollDOM.offsetWidth - view.scrollDOM.clientWidth;
    const draw = () => {
        queued = false;
        if (!up || !view) return;
        /* Placed, measured and drawn in one pass from the editor as it is now: worked out apart, a find
       bar opening leaves the frame off the map. Aligned to the scroller, so a find bar keeps its place. */
        const box = element.offsetParent?.getBoundingClientRect(),
            sc = view.scrollDOM;
        if (!box) return;
        Object.assign(element.style, {
            top: sc.getBoundingClientRect().top - box.top + 'px',
            height: sc.clientHeight + 'px',
            right: mode === 'always' ? '0' : scrollbar() + 'px',
        });
        const { state } = view,
            doc = state.doc;
        const { folds, height, lines, r, frameHeight, travel, offset } = measure();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = WIDTH * dpr;
        canvas.height = height * dpr;
        const g = canvas.getContext('2d');
        g.scale(dpr, dpr);
        const first = Math.floor(offset / LINE) + 1;
        const last = Math.min(lines, Math.ceil((offset + height) / LINE) + 1);
        if (first <= lines) {
            const from = doc.line(fileLine(first, folds)).from,
                to = doc.line(fileLine(last, folds)).to;
            // Text not yet parsed is drawn plain, and coloured on the update a new tree brings.
            const inked = []; // [from, to, colour], in document order
            engine.highlightTree(
                engine.syntaxTree(state),
                ink,
                (a, b, colours) => inked.push([a, b, colours.split(' ').pop()]),
                from,
                to
            );
            let k = 0;
            for (let v = first; v <= last; v++) {
                const line = doc.line(fileLine(v, folds)),
                    text = line.text,
                    y = (v - 1) * LINE - offset;
                for (let i = 0, x = 0; i < text.length && x < WIDTH; ) {
                    if (text[i] === ' ' || text[i] === '\t') {
                        x += text[i] === '\t' ? TAB * CHAR : CHAR;
                        i++;
                        continue;
                    }
                    // A run up to the next space or the next change of colour, whichever is first.
                    const at = line.from + i;
                    while (k < inked.length && inked[k][1] <= at) k++;
                    const run = k < inked.length && inked[k][0] <= at ? inked[k] : null;
                    const stop = run ? run[1] - line.from : k < inked.length ? inked[k][0] - line.from : text.length;
                    let j = i + 1;
                    while (j < text.length && j < stop && text[j] !== ' ' && text[j] !== '\t') j++;
                    g.fillStyle = run ? run[2] : quiet;
                    g.fillRect(x, y, (j - i) * CHAR, BLOCK);
                    x += (j - i) * CHAR;
                    i = j;
                }
            }
        }
        frame.style.top = r * travel + 'px';
        frame.style.height = frameHeight + 'px';
    };
    const redraw = () => {
        if (up && !queued) {
            queued = true;
            requestAnimationFrame(draw);
        }
    };

    const show = () => {
        if (!view || mode === 'never') return;
        if (mode === 'scroll') linger();
        if (up) return;
        up = true;
        Object.assign(element.style, { opacity: '1', pointerEvents: 'auto' });
        draw();
    };
    const putAway = () => {
        up = false;
        Object.assign(element.style, { opacity: '0', pointerEvents: 'none' });
    };
    const hide = () => {
        if (up && mode !== 'always' && grab === null && !over) putAway();
    };
    const linger = () => {
        clearTimeout(lingering);
        lingering = setTimeout(hide, LINGER);
    };
    const onScroll = () => {
        const top = view.scrollDOM.scrollTop;
        if (mode === 'scroll' && top !== lastTop) show();
        lastTop = top;
        redraw();
    };

    /* Placed at the pointer, not moved by its delta, so a frame pushed past an end comes back with
     it. Repeated because wrapped lines change the frame's size where it lands. */
    const follow = (clientY) => {
        const mapTop = element.getBoundingClientRect().top;
        for (let pass = 0; pass < 3; pass++) {
            const m = measure();
            if (m.travel <= 0) return;
            const want = Math.max(0, Math.min(m.travel, clientY - mapTop - grab * m.frameHeight));
            if (pass > 0 && Math.abs(m.r * m.travel - want) < 0.5) return;
            scrollTo(want / m.travel, m);
        }
    };
    element.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !view) return;
        e.preventDefault();
        const f = frame.getBoundingClientRect();
        const off = e.clientY < f.top || e.clientY > f.bottom;
        grab = off ? 0.5 : (e.clientY - f.top) / Math.max(1, f.height);
        if (off) follow(e.clientY);
        // Captured so a drag past the map keeps scrolling; throws for a pointer that is no longer active.
        try {
            element.setPointerCapture(e.pointerId);
        } catch {}
    });
    element.addEventListener('pointermove', (e) => {
        if (grab !== null) follow(e.clientY);
    });
    const release = () => {
        if (grab === null) return;
        grab = null;
        if (mode === 'scroll' && !over) linger();
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('pointerenter', () => {
        over = true;
        clearTimeout(lingering);
    });
    element.addEventListener('pointerleave', () => {
        over = false;
        if (grab === null) hide();
    });
    element.addEventListener(
        'wheel',
        (e) => {
            if (!view) return;
            e.preventDefault();
            const step = e.deltaMode === 1 ? view.defaultLineHeight : 1;
            view.scrollDOM.scrollTop += e.deltaY * step;
            view.scrollDOM.scrollLeft += e.deltaX * step;
        },
        { passive: false }
    );

    return {
        element,
        inset: () => (mode === 'always' ? WIDTH + 'px' : '0'),
        attach(next) {
            if (next === view) return;
            view?.scrollDOM.removeEventListener('scroll', onScroll);
            view = next;
            view?.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
            lastTop = view ? view.scrollDOM.scrollTop : 0;
            if (!view) {
                grab = null;
                over = false;
                putAway();
                return;
            }
            if (mode === 'always') show();
            redraw();
        },
        setMode(next) {
            mode = next === 'always' || next === 'never' ? next : 'scroll';
            element.style.boxShadow = mode === 'always' ? 'none' : '-8px 0 24px rgba(0,0,0,.18)';
            clearTimeout(lingering);
            if (mode === 'always') show();
            else {
                over = false;
                grab = null;
                putAway();
            }
        },
        near(e) {
            if (up || !view || mode !== 'scroll') return;
            const sc = view.scrollDOM.getBoundingClientRect(),
                edge = sc.right - scrollbar();
            // Only as far down as the map reaches: a horizontal scrollbar under the text is not the edge.
            if (
                e.clientX >= edge - EDGE &&
                e.clientX < edge &&
                e.clientY >= sc.top &&
                e.clientY < sc.top + view.scrollDOM.clientHeight
            )
                show();
        },
        update: redraw,
    };
};
