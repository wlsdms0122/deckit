const MINIMAP_STYLE = `
    .editor-minimap {
        position: absolute;
        right: 0;
        z-index: 4;
        opacity: 0;
        pointer-events: none;
        background: color-mix(in srgb, var(--deckit-text) 4%, var(--deckit-background));
        border-left: var(--deckit-border);
        box-shadow: -8px 0 24px rgba(0, 0, 0, 0.18);
        transition: opacity var(--deckit-fast) var(--deckit-easing);
    }
    .editor-minimap[data-mode='always'] { box-shadow: none; }
    .editor-minimap[data-shown] { opacity: 1; pointer-events: auto; }
    .editor-minimap-canvas { display: block; width: 100%; height: 100%; }
    .editor-minimap-frame {
        position: absolute;
        left: 0;
        right: 0;
        background: var(--deckit-selected);
        pointer-events: none;
    }
`;

// The file in miniature at the editor's right edge. `mode` is the setting: always beside the code, while scrolling
// over the code, or never.
function codeMinimap({ engine, theme, ui, colorHighlighter }) {
    const WIDTH = 96;
    // In pixels: a line is a 2px block and a 1px gap; a character is 1px across.
    const LINE_HEIGHT = 3;
    const BLOCK_HEIGHT = 2;
    const CHARACTER_WIDTH = 1;
    const TAB_CHARACTERS = 4;
    // How near the right edge, in pixels, the pointer brings it up.
    const EDGE_REACH = 24;
    const LINGER_MS = 1200;

    let mode = 'scroll';
    let view = null;
    let shown = false;
    let drawQueued = false;
    let pointerOver = false;
    let lingering = null;
    // Where the frame was taken hold of, as a share of its height, so a frame resizing under the pointer stays held there.
    let grabbedAt = null;
    // To tell a vertical scroll from a sideways one.
    let lastScrollTop = 0;

    const element = ui.element('div', { className: 'editor-minimap', style: { width: WIDTH + 'px' } });
    const canvas = ui.element('canvas', { className: 'editor-minimap-canvas' });
    const frame = ui.element('div', { className: 'editor-minimap-frame' });
    element.append(canvas, frame);

    element.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !view) return;
        event.preventDefault();
        const box = frame.getBoundingClientRect();
        const outside = event.clientY < box.top || event.clientY > box.bottom;
        grabbedAt = outside ? 0.5 : (event.clientY - box.top) / Math.max(1, box.height);
        if (outside) follow(event.clientY);
        // Captured so a drag past the map keeps scrolling; throws for a pointer that is no longer active.
        try {
            element.setPointerCapture(event.pointerId);
        } catch {}
    });
    element.addEventListener('pointermove', (event) => {
        if (grabbedAt !== null) follow(event.clientY);
    });
    element.addEventListener('pointerup', letGo);
    element.addEventListener('pointercancel', letGo);
    element.addEventListener('pointerenter', () => {
        pointerOver = true;
        clearTimeout(lingering);
    });
    element.addEventListener('pointerleave', () => {
        pointerOver = false;
        if (grabbedAt === null) hide();
    });
    element.addEventListener(
        'wheel',
        (event) => {
            if (!view) return;
            event.preventDefault();
            const step = event.deltaMode === 1 ? view.defaultLineHeight : 1;
            view.scrollDOM.scrollTop += event.deltaY * step;
            view.scrollDOM.scrollLeft += event.deltaX * step;
        },
        { passive: false }
    );

    return {
        element,
        inset: () => (mode === 'always' ? WIDTH + 'px' : '0'),
        attach,
        setMode,
        showNear,
        update: redraw,
    };

    function attach(next) {
        if (next === view) return;
        view?.scrollDOM.removeEventListener('scroll', heardScroll);
        view = next;
        view?.scrollDOM.addEventListener('scroll', heardScroll, { passive: true });
        lastScrollTop = view ? view.scrollDOM.scrollTop : 0;
        if (!view) {
            grabbedAt = null;
            pointerOver = false;
            putAway();
            return;
        }
        if (mode === 'always') show();
        redraw();
    }

    function setMode(next) {
        mode = next;
        element.dataset.mode = mode;
        clearTimeout(lingering);
        if (mode === 'always') return show();
        pointerOver = false;
        grabbedAt = null;
        putAway();
    }

    // Only as far down as the map reaches: a horizontal scrollbar under the text is not the edge.
    function showNear(event) {
        if (shown || !view || mode !== 'scroll') return;
        const scroller = view.scrollDOM.getBoundingClientRect();
        const edge = scroller.right - scrollbarWidth();
        if (
            event.clientX >= edge - EDGE_REACH &&
            event.clientX < edge &&
            event.clientY >= scroller.top &&
            event.clientY < scroller.top + view.scrollDOM.clientHeight
        )
            show();
    }

    // Folds that overlap or touch are joined: the editor keeps an inner fold under an outer one, and counting both
    // would drop its lines twice. shownLineOf and fileLineOf rely on ordered, disjoint ranges.
    function foldsOf(state) {
        const content = state.doc;
        const folds = [];
        engine.foldedRanges(state).between(0, content.length, (from, to) => {
            const first = content.lineAt(from).number;
            const last = content.lineAt(to).number;
            if (last <= first) return;
            const previous = folds[folds.length - 1];
            if (previous && first <= previous[1]) previous[1] = Math.max(previous[1], last);
            else folds.push([first, last]);
        });
        return folds;
    }

    function shownLineOf(fileLine, folds) {
        let shownLine = fileLine;
        for (const [first, last] of folds) {
            if (fileLine > last) shownLine -= last - first;
            else if (fileLine > first) {
                shownLine -= fileLine - first;
                break;
            } else break;
        }
        return shownLine;
    }

    function fileLineOf(shownLine, folds) {
        let fileLine = shownLine;
        for (const [first, last] of folds) {
            if (first < fileLine) fileLine += last - first;
            else break;
        }
        return fileLine;
    }

    // A shown line with a fraction (how far down that line), so wrapped lines read the same both ways.
    function shownLineAt(scrollTop, folds) {
        const height = scrollTop - view.documentPadding.top;
        const block = view.lineBlockAtHeight(height);
        const fraction = Math.max(0, Math.min(1, (height - block.top) / Math.max(1, block.height)));
        return shownLineOf(view.state.doc.lineAt(block.from).number, folds) + fraction;
    }

    function scrollTopOf(shownLine, folds) {
        const content = view.state.doc;
        const whole = Math.floor(shownLine);
        const fileLine = Math.max(1, Math.min(content.lines, fileLineOf(Math.max(1, whole), folds)));
        const block = view.lineBlockAt(content.line(fileLine).from);
        return block.top + (shownLine - whole) * block.height + view.documentPadding.top;
    }

    // All in shown lines, so the frame and the drawing agree where lines wrap. `scrolled` is how far the file is
    // scrolled, 0 at the top and 1 at the bottom.
    function measure() {
        const folds = foldsOf(view.state);
        const scroller = view.scrollDOM;
        const height = scroller.clientHeight;
        const lines = shownLineOf(view.state.doc.lines, folds);
        const top = shownLineAt(scroller.scrollTop, folds);
        const onScreen = Math.max(0, shownLineAt(scroller.scrollTop + height, folds) - top);
        const scrollable = Math.max(0, lines - onScreen);
        const scrolled = scrollable > 0 ? Math.max(0, Math.min(1, (top - 1) / scrollable)) : 0;
        const total = lines * LINE_HEIGHT;
        const frameHeight = Math.max(LINE_HEIGHT, Math.min(onScreen * LINE_HEIGHT, height));
        const travel = Math.max(0, Math.min(total, height) - frameHeight);
        return {
            folds,
            height,
            lines,
            scrollable,
            scrolled,
            frameHeight,
            travel,
            offset: total > height ? scrolled * (total - height) : 0,
        };
    }

    // The ends are the scroller's own, so the padding above the first line and below the last is reached.
    function scrollTo(scrolled, measured) {
        const scroller = view.scrollDOM;
        const at = Math.max(0, Math.min(1, scrolled));
        scroller.scrollTop =
            at <= 0
                ? 0
                : at >= 1
                  ? scroller.scrollHeight - scroller.clientHeight
                  : scrollTopOf(1 + at * measured.scrollable, measured.folds);
    }

    function scrollbarWidth() {
        return view.scrollDOM.offsetWidth - view.scrollDOM.clientWidth;
    }

    // Placed, measured and drawn in one pass from the editor as it is now: a find bar opening between would leave the
    // frame off the map. Aligned to the scroller, so a find bar keeps its place.
    function draw() {
        drawQueued = false;
        if (!shown || !view) return;
        const box = element.offsetParent?.getBoundingClientRect();
        if (!box) return;
        const scroller = view.scrollDOM;
        Object.assign(element.style, {
            top: scroller.getBoundingClientRect().top - box.top + 'px',
            height: scroller.clientHeight + 'px',
            right: mode === 'always' ? '0' : scrollbarWidth() + 'px',
        });
        const { state } = view;
        const content = state.doc;
        const { folds, height, lines, scrolled, frameHeight, travel, offset } = measure();
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = WIDTH * pixelRatio;
        canvas.height = height * pixelRatio;
        const context = canvas.getContext('2d');
        context.scale(pixelRatio, pixelRatio);
        const first = Math.floor(offset / LINE_HEIGHT) + 1;
        const last = Math.min(lines, Math.ceil((offset + height) / LINE_HEIGHT) + 1);
        if (first <= lines) {
            const from = content.line(fileLineOf(first, folds)).from;
            const to = content.line(fileLineOf(last, folds)).to;
            // Text not yet parsed is drawn plain, and coloured on the update a new tree brings.
            const colored = []; // [from, to, colour], in document order
            engine.highlightTree(
                engine.syntaxTree(state),
                colorHighlighter,
                (start, end, colors) => colored.push([start, end, colors.split(' ').pop()]),
                from,
                to
            );
            let run = 0;
            for (let shownLine = first; shownLine <= last; shownLine++) {
                const line = content.line(fileLineOf(shownLine, folds));
                const text = line.text;
                const y = (shownLine - 1) * LINE_HEIGHT - offset;
                for (let index = 0, x = 0; index < text.length && x < WIDTH; ) {
                    if (text[index] === ' ' || text[index] === '\t') {
                        x += text[index] === '\t' ? TAB_CHARACTERS * CHARACTER_WIDTH : CHARACTER_WIDTH;
                        index++;
                        continue;
                    }
                    // A stretch up to the next space or the next change of colour, whichever is first.
                    const at = line.from + index;
                    while (run < colored.length && colored[run][1] <= at) run++;
                    const color = run < colored.length && colored[run][0] <= at ? colored[run] : null;
                    const stop = color
                        ? color[1] - line.from
                        : run < colored.length
                          ? colored[run][0] - line.from
                          : text.length;
                    let end = index + 1;
                    while (end < text.length && end < stop && text[end] !== ' ' && text[end] !== '\t') end++;
                    context.fillStyle = color ? color[2] : theme.color.muted;
                    context.fillRect(x, y, (end - index) * CHARACTER_WIDTH, BLOCK_HEIGHT);
                    x += (end - index) * CHARACTER_WIDTH;
                    index = end;
                }
            }
        }
        frame.style.top = scrolled * travel + 'px';
        frame.style.height = frameHeight + 'px';
    }

    function redraw() {
        if (!shown || drawQueued) return;
        drawQueued = true;
        requestAnimationFrame(draw);
    }

    function show() {
        if (!view || mode === 'never') return;
        if (mode === 'scroll') linger();
        if (shown) return;
        shown = true;
        element.toggleAttribute('data-shown', true);
        draw();
    }

    function putAway() {
        shown = false;
        element.toggleAttribute('data-shown', false);
    }

    function hide() {
        if (shown && mode !== 'always' && grabbedAt === null && !pointerOver) putAway();
    }

    function linger() {
        clearTimeout(lingering);
        lingering = setTimeout(hide, LINGER_MS);
    }

    function heardScroll() {
        const top = view.scrollDOM.scrollTop;
        if (mode === 'scroll' && top !== lastScrollTop) show();
        lastScrollTop = top;
        redraw();
    }

    // Placed at the pointer, so a frame pushed past an end comes back with it. Repeated because wrapped lines change
    // the frame's size where it lands.
    function follow(clientY) {
        const mapTop = element.getBoundingClientRect().top;
        for (let pass = 0; pass < 3; pass++) {
            const measured = measure();
            if (measured.travel <= 0) return;
            const wanted = Math.max(0, Math.min(measured.travel, clientY - mapTop - grabbedAt * measured.frameHeight));
            if (pass > 0 && Math.abs(measured.scrolled * measured.travel - wanted) < 0.5) return;
            scrollTo(wanted / measured.travel, measured);
        }
    }

    function letGo() {
        if (grabbedAt === null) return;
        grabbedAt = null;
        if (mode === 'scroll' && !pointerOver) linger();
    }
}
