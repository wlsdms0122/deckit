import * as TEXT from './model/reading.js';
import * as LAYOUT from './model/layout.js';
import * as DOCK_MODEL from '../dock/model/dock.js';
import * as MODS from '../mods/index.js';

// How many marks back what changed is kept: the pairs of a document, and what went from the desktop.
const KEPT = 256;
// What a seat's pointer does on what a reading named.
const ACTIONS = Object.freeze(['press', 'double', 'context', 'hover', 'scroll']);
const LEVELS = Object.freeze(['desktop', 'window', 'node']);
const KNOBS = Object.freeze(['depth', 'roles', 'all', 'items', 'text', 'lines']);
// The buttons of a title bar, as they read.
const BUTTONS = Object.freeze({ close: 'Close', minimize: 'Minimize', zoom: 'Zoom' });
// How many pixels a point a picture is made at, at most.
const SCALE = 4;
// How long a frame is, in ms: the seats are told that the desktop changed at most once in it.
const FRAME = 16;

// What a seat reads of the desktop: the desktop itself, the seats, the Dock and the windows in the seat's order, from
// what the desktop keeps; a window, the parts the shell draws of it and each document it shows as the environment
// reads it; what is under one ref; what changed since a mark; and a picture. Refs: a window is `w<id>`, its parts
// `w<id>.close`, `.minimize`, `.zoom`, `.title` and `.edge.<name>`, an item of the Dock `dock.<mod>`, and an element
// `<document>.<n>` as the environment names it, the same for every seat.
// The mark is one count for the desktop: it goes up as a line of the desktop reads otherwise for some seat, a
// pointer's place apart, and as a document tells that what it shows changed. `READ` reads a page (environment: SHELL
// `read`), `OVERLAY` is the pages' overlays, `web` what the web engine answered, `deckit` what connect answered,
// and `desk` is what the desktop keeps and answers of itself.
export function createReading({ READ, OVERLAY, web, deckit, desk }) {
    // MARK: - Property
    const documents = new Map(); // a document's number -> { page, born, pairs }, its marks and the reader's counts
    const numbers = new WeakMap(); // a page -> the number of the document it shows
    const webs = new Set(); // the web pages mods show
    const tracks = new Map(); // seat id -> ref -> { text, born, at }: its desktop lines and the marks they changed at
    const gone = []; // { seat, ref, mark }: what went from a seat's desktop, or from every seat's where `seat` is null
    let mark = 0;
    let floor = 0; // the oldest mark what changed is known since
    let telling = false; // whether the seats are told of the mark as the next frame is due

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        web.onPage((page) => webs.add(page));
        READ.listen(({ page, document, count }) => {
            if (desk.windowAt(page)) noted(page, document, count);
        });
    }

    // The desktop's lines are held against what each seat read last, as the desktop changes.
    function settle() {
        for (const [number, { page }] of documents) if (!desk.windowAt(page)) documents.delete(number);
        for (const page of webs) if (!web.pageFor(page)) webs.delete(page);
        const seen = new Map([...desk.hands.keys()].map((seat) => [seat, linesOf(desktopOf(seat), { held: true })]));
        for (const seat of [...tracks.keys()]) if (!seen.has(seat)) tracks.delete(seat);
        const differs = [...seen].some(([seat, lines]) => {
            const track = tracks.get(seat);
            return (
                !track || track.size !== lines.size || [...lines].some(([ref, text]) => track.get(ref)?.text !== text)
            );
        });
        if (!differs) return;
        raise();
        for (const [seat, lines] of seen) {
            const track = tracks.get(seat) ?? new Map();
            tracks.set(seat, track);
            for (const ref of [...track.keys()]) {
                if (lines.has(ref)) continue;
                track.delete(ref);
                went(seat, ref);
            }
            for (const [ref, text] of lines) {
                const had = track.get(ref);
                if (!had) track.set(ref, { text, born: mark, at: mark });
                else if (had.text !== text) Object.assign(had, { text, at: mark });
            }
        }
    }

    // A reading for `seat`: `level` 'desktop', 'window' with `window`, or 'node' with `ref`, as text or, `format`
    // 'json', as data. The other fields are the knobs, handed to the reader as they are.
    async function read(seat, { level = 'desktop', window, ref, format = 'text', ...given }) {
        if (!LEVELS.includes(level) || !['text', 'json'].includes(format))
            throw refusal('INVALID_ARGUMENT', 'a reading is of the desktop, a window or a node, as text or json');
        const knobs = Object.fromEntries(
            KNOBS.flatMap((knob) => (given[knob] === undefined ? [] : [[knob, given[knob]]]))
        );
        settle();
        const read =
            level === 'desktop'
                ? desktopOf(seat.id)
                : level === 'window'
                  ? await windowOf(seat.id, idOf(window), knobs)
                  : await nodeOf(seat.id, String(ref), knobs);
        const data = { ...read, mark };
        return format === 'json' ? { data, mark } : { text: TEXT[level](data), mark };
    }

    // What reads otherwise for `seat` since the mark `since`: the desktop's lines, and the lines of the documents in
    // the windows on its screen that told a change after it. With no mark, the mark now and nothing. A mark older
    // than what is kept, or one the desktop never had, is refused STALE.
    async function changes(seat, { since = null } = {}) {
        settle();
        const from = since ?? mark;
        if (!Number.isInteger(from) || from < floor || from > mark)
            throw refusal('STALE', `what changed since the mark ${from} is not kept: read again`);
        const track = tracks.get(seat.id) ?? new Map();
        const entries = [];
        for (const [ref, line] of linesOf(desktopOf(seat.id))) {
            const { born, at } = track.get(ref);
            if (at > from) entries.push({ kind: born > from ? '+' : '~', line });
        }
        for (const { seat: of, ref, mark: at } of gone)
            if (at > from && [null, seat.id].includes(of) && !track.has(ref)) entries.push({ kind: '-', line: ref });
        const ids = [...desk.MANAGER.viewOf(seat.id), ...desk.panelFrames().map(({ window }) => window)];
        for (const { id } of ids) {
            for (const { page, part, name, rect, typing } of pagesOf(id)) {
                const number = numbers.get(page);
                const kept = documents.get(number);
                if (!kept || kept.pairs.at(-1).mark <= from) continue;
                if (kept.born > from) {
                    const size = rect ?? { width: 0, height: 0 };
                    const line = `${TEXT.documentLine({ document: number, part, name, ...size })} in w${id}`;
                    entries.push({ kind: '+', line });
                    continue;
                }
                const pair = kept.pairs.findLast((each) => each.mark <= from);
                if (!pair) throw refusal('STALE', `what changed since the mark ${from} is not kept: read again`);
                const answer = await asked(READ.changes(page, { document: number, count: pair.count }), true);
                if (!answer) continue;
                noted(page, answer.document, answer.count);
                for (const { kind, depth: _depth, ...line } of answer.entries)
                    entries.push({ kind, line: kind === '-' ? line.ref : TEXT.elementLine(withSeat(line, typing)) });
            }
        }
        return { text: TEXT.changes({ from, to: mark, entries }), mark };
    }

    // A picture for `seat`: of the desktop in its order, of the window `window` alone, of what `ref` names in its
    // window, or of `rect` of the desktop, `scale` pixels a point. Answers the PNG in base64, its size in pixels and
    // `at`, the desktop's point its top left is at.
    async function capture(seat, { window, ref, rect, scale = 1 }) {
        const named = [window, ref, rect].filter((each) => each !== undefined);
        if (named.length > 1 || !(scale > 0 && scale <= SCALE))
            throw refusal('INVALID_ARGUMENT', `a picture is of one thing, at up to ${SCALE} pixels a point`);
        let laid = desk.laidFor(seat.id);
        let of = { x: 0, y: 0, ...desk.stage().size() };
        if (window !== undefined) {
            const id = idOf(window);
            of = factOf(seat.id, id).frame;
            laid = desk.laidOfWindow(id);
        } else if (ref !== undefined) {
            const place = await placeOf(seat.id, String(ref), { scrolls: false });
            of = place.rect;
            if (place.window !== null) laid = desk.laidOfWindow(place.window);
        } else if (rect !== undefined) {
            of = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            if (!Object.values(of).every(Number.isFinite) || !(of.width > 0 && of.height > 0))
                throw refusal('INVALID_ARGUMENT', 'a rect is x, y, width and height, with room in it');
        }
        const png = await desk.stage().capture(laid, { rect: of, scale });
        return {
            png: png.toString('base64'),
            width: png.readUInt32BE(16),
            height: png.readUInt32BE(20),
            at: { x: of.x, y: of.y },
        };
    }

    // Where the pointer of `seat` goes to act on what `ref` names, once it is scrolled into view: `{ at, by }`, `at`
    // the desktop's point at the middle of what shows of it, and `by` a point to pass first, the Dock's sliver for an
    // item of the Dock, which brings the Dock out, or null.
    async function place(seat, ref) {
        const { rect, by = null } = await placeOf(seat.id, String(ref), { scrolls: true });
        return { at: { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }, by };
    }

    // MARK: - Private
    function refusal(kind, message) {
        return Object.assign(new Error(message), { stage: 'call', kind });
    }

    // What the environment's reader answered, its refusals as a seat is refused; with `lenient`, null for what is gone.
    function asked(answer, lenient = false) {
        return answer.catch((error) => {
            if (error?.code === 'GONE' && lenient) return null;
            if (error?.code === 'GONE') throw refusal('GONE', 'nothing read here has that ref any more');
            if (error?.code === 'STALE') throw refusal('STALE', 'what changed since that mark is not kept: read again');
            throw error;
        });
    }

    function raise() {
        mark += 1;
        if (telling) return;
        telling = true;
        setTimeout(() => {
            telling = false;
            for (const seat of desk.seated.values()) desk.tells().changed(seat, { mark });
        }, FRAME);
    }

    function went(seat, ref) {
        gone.push({ seat, ref, mark });
        if (gone.length > KEPT) floor = gone.shift().mark;
    }

    // A page's document is at `count`, as its reader answered or told: the mark goes up where that is news, and the
    // pair is kept. A page that shows another document than it did lost the one before.
    function noted(page, document, count) {
        const had = numbers.get(page);
        if (had !== undefined && had > document) return;
        numbers.set(page, document);
        let kept = documents.get(document);
        if (kept && kept.pairs.at(-1).count >= count) return;
        raise();
        if (had !== undefined && had !== document && documents.delete(had)) went(null, `document ${had}`);
        if (!kept) documents.set(document, (kept = { page, born: mark, pairs: [] }));
        kept.pairs.push({ mark, count });
        if (kept.pairs.length > KEPT) kept.pairs.shift();
    }

    function idOf(window) {
        const [, id] = /^w?(\d+)$/.exec(String(window)) ?? [];
        if (id === undefined) throw refusal('INVALID_ARGUMENT', 'a window is named by its id, as w3');
        return Number(id);
    }

    // The name of each mod that loads, by its id: read once for all the windows of a reading.
    function namesNow() {
        return new Map(MODS.loaded(deckit.mods).map(({ id, name }) => [id, name]));
    }

    // A window or a panel window as `seat` reads it, refused NOT_FOUND for an id none has; `names` as namesNow has
    // them.
    function factOf(seat, id, names = namesNow()) {
        const nameOf = (mod) => names.get(mod) || mod;
        const window = desk.windows.get(id);
        if (window) {
            return {
                kind: 'window',
                id: `w${id}`,
                title: (window.bar.style === 'titled' && window.title) || nameOf(window.mod),
                mod: window.mod,
                frame: { ...desk.MANAGER.frameOf(id) },
                key: desk.MANAGER.holderOf(id),
                minimized: desk.MANAGER.isMinimized(seat, id),
                zoomed: desk.MANAGER.isZoomed(id),
                tile: desk.MANAGER.tileNameOf(id),
            };
        }
        const panel = desk.panelFrames().find(({ window: { id: each } }) => each === id);
        if (!panel) throw refusal('NOT_FOUND', `no window ${id} is open`);
        const { mod, edge } = panel.window;
        const key = desk.panelHolderOf(id);
        return { kind: 'panel', id: `w${id}`, title: nameOf(mod), mod, edge, frame: { ...panel.frame }, key };
    }

    // The desktop as `seat` reads it, the windows front to back in its order.
    function desktopOf(seat) {
        const items = desk.dock().items();
        const active = desk.windows.get(desk.MANAGER.keyOf(seat))?.mod ?? null;
        const attention = desk.ACTIVATION.attentionOf(seat);
        const { width, height } = desk.stage().size();
        const names = namesNow();
        return {
            desktop: { width, height },
            seats: [...desk.hands].map(([id, { pointer }]) => ({
                id,
                name: desk.seated.get(id)?.user.name ?? id,
                at: pointer && { x: Math.round(pointer.x), y: Math.round(pointer.y) },
                key: desk.MANAGER.keyOf(id) === null ? null : `w${desk.MANAGER.keyOf(id)}`,
                you: id === seat,
            })),
            dock: items.map(({ id, name, running }) => ({
                id,
                name: name ?? id,
                running: !!running,
                active: id === active,
                attention: attention.includes(id),
                ref: `dock.${id}`,
            })),
            windows: desk.MANAGER.orderOf(seat)
                .reverse()
                .map((id) => factOf(seat, id, names)),
            panels: desk.panelFrames().map(({ window }) => factOf(seat, window.id, names)),
        };
    }

    // The desktop's lines by ref, in the order they read; `held` as they are held against what was read before, a
    // seat's line without where its pointer is and whose it is.
    function linesOf({ desktop, seats, dock, windows, panels }, { held = false } = {}) {
        const seat = (each) => TEXT.seatLine(held ? { ...each, at: null, you: false } : each);
        return new Map([
            ['desktop', `desktop ${desktop.width}x${desktop.height}`],
            ...seats.map((each) => [each.id, seat(each)]),
            ...dock.map((item) => [item.ref, TEXT.itemLine(item)]),
            ...[...windows, ...panels].map((window) => [window.id, TEXT.windowLine(window)]),
        ]);
    }

    // The pages a window or a panel window shows, bottom to top: `{ page, part, name, rect, typing }`, `part` its
    // 'content', a 'child' a region of it shows, named by its mod, a 'web' page in one of them or an 'overlay' of one,
    // `rect` where it is on the desktop, which the shell is not told of a web page, and `typing` the seat whose keys
    // go to it.
    function pagesOf(id) {
        const content = (desk.windows.get(id) ?? desk.panels.get(id))?.surface ?? null;
        const laid = desk
            .laidOfWindow(id)
            .filter(({ page }) => desk.windowAt(page))
            .map(({ page, rect }) => {
                if (OVERLAY.ownerOf(page) !== page) return { page, part: 'overlay', rect };
                if (page === content) return { page, part: 'content', rect };
                return { page, part: 'child', name: deckit.mods.modOf(page) ?? null, rect };
            });
        const inside = [...webs]
            .filter((page) => laid.some((each) => each.page === web.pageFor(page)))
            .map((page) => ({ page, part: 'web', rect: null }));
        return [...laid, ...inside].map((each) => ({ name: null, ...each, typing: desk.typingIn(each.page) }));
    }

    // A line of a document with the seat whose keys go to it after `focused`.
    function withSeat(line, seat) {
        if (!seat || !line.states?.includes('focused')) return line;
        return { ...line, states: line.states.map((state) => (state === 'focused' ? `focused ${seat}` : state)) };
    }

    async function windowOf(seat, id, knobs) {
        const own = factOf(seat, id);
        const outlines = await Promise.all(
            pagesOf(id).map(async ({ page, part, name, typing }) => {
                const outline = await asked(READ.outline(page, knobs), true);
                if (!outline) return [];
                noted(page, outline.document, outline.count);
                const { document, width, height } = outline;
                const lines = outline.lines.map((line) => withSeat(line, typing));
                return [{ document, part, ...(name ? { name } : {}), width, height, lines }];
            })
        );
        return { window: own, parts: partsOf(id).map(({ rect: _rect, ...part }) => part), documents: outlines.flat() };
    }

    // The parts of a normal window the shell draws that are listed: the buttons of its title bar, and the title bar
    // of a titled one. `rect` is on the desktop.
    function partsOf(id) {
        const window = desk.windows.get(id);
        if (!window) return [];
        const frame = desk.MANAGER.frameOf(id);
        const { bar } = window;
        const buttons = LAYOUT.buttonsOf(bar).map(({ name, x, y, width, height }) => ({
            role: 'button',
            name: BUTTONS[name],
            states: bar.enabled[name] ? [] : ['disabled'],
            ref: `w${id}.${name}`,
            rect: { x: frame.x + x, y: frame.y + y, width, height },
        }));
        if (bar.style !== 'titled') return buttons;
        const rect = { x: frame.x, y: frame.y, width: frame.width, height: bar.height };
        return [...buttons, { role: 'titlebar', name: window.title, states: [], ref: `w${id}.title`, rect }];
    }

    // A part the shell draws, by its ref, with `rect` on the desktop, the window it is of, and for an item of the Dock
    // `by`, the middle of the Dock's sliver; or null for a ref that names none.
    function partOf(seat, ref) {
        const [, mod] = /^dock\.(.+)$/.exec(ref) ?? [];
        if (mod !== undefined) {
            const items = desk.dock().items();
            const item = desktopOf(seat).dock.find(({ id }) => id === mod);
            if (!item) return null;
            const [sliver] = DOCK_MODEL.inputOf(desk.area(), true, items);
            const by = { x: sliver.x + sliver.width / 2, y: sliver.y + sliver.height / 2 };
            const states = ['running', 'active', 'attention'].filter((state) => item[state]);
            const line = { role: 'item', name: item.name, states, ref };
            return { line, rect: DOCK_MODEL.tileOf(desk.area(), items, mod), window: null, by };
        }
        const [, window, name, edge] = /^w(\d+)\.(close|minimize|zoom|title|edge\.([a-z-]+))$/.exec(ref) ?? [];
        const id = Number(window);
        if (window === undefined || !desk.windows.has(id)) return null;
        const { rect: listed = null, ...line } = partsOf(id).find((part) => part.ref === ref) ?? {};
        if (listed) return { line, rect: listed, window: id };
        const parts = LAYOUT.partsOf(desk.MANAGER.frameOf(id), desk.windows.get(id).bar);
        const band = parts.edges.find((each) => each.edge === edge)?.rect;
        if (!band) return null;
        const rect = { ...band, x: parts.rect.x + band.x, y: parts.rect.y + band.y };
        return { line: { role: 'edge', name: edge, states: [], ref }, rect, window: id };
    }

    // The page whose document has the element `ref` names, with where the page is on the desktop: refused GONE for a
    // ref no document here has.
    function pageOf(ref) {
        const [, number] = /^(\d+)\.\d+$/.exec(ref) ?? [];
        const kept = documents.get(Number(number));
        const window = kept && desk.windowAt(kept.page);
        if (!window) throw refusal('GONE', 'nothing read here has that ref');
        const { rect, typing } = pagesOf(window.id).find(({ page }) => page === kept.page) ?? {};
        return { page: kept.page, window: window.id, rect: rect ?? null, typing: typing ?? null };
    }

    // Where what `ref` names is on the desktop, `{ rect, window, by }`, what shows of an element in its page; with
    // `scrolls`, once it is scrolled into view.
    async function placeOf(seat, ref, { scrolls }) {
        const part = partOf(seat, ref);
        if (part) return part;
        const { page, window, rect: on } = pageOf(ref);
        if (!on) throw refusal('REFUSED', 'where a web page lies on the desktop is not told yet');
        const inPage = scrolls ? await asked(READ.place(page, ref)) : (await asked(READ.node(page, ref, {}))).rect;
        const left = Math.max(0, inPage.x);
        const top = Math.max(0, inPage.y);
        const width = Math.max(1, Math.min(on.width, inPage.x + inPage.width) - left);
        const height = Math.max(1, Math.min(on.height, inPage.y + inPage.height) - top);
        return { rect: { x: on.x + left, y: on.y + top, width, height }, window };
    }

    async function nodeOf(seat, ref, knobs) {
        const part = partOf(seat, ref);
        if (part) return { node: part.line, rect: part.rect };
        const { page, rect: on, typing } = pageOf(ref);
        const answer = await asked(READ.node(page, ref, knobs));
        noted(page, answer.document, answer.count);
        const { line, rect, scroll, lines, more, selection, caret } = answer;
        const moved = (each) => (on ? { ...each, x: on.x + each.x, y: on.y + each.y } : null);
        return {
            node: withSeat(line, typing),
            ...(on ? { rect: moved(rect) } : { size: { width: rect.width, height: rect.height } }),
            ...(scroll ? { scroll } : {}),
            lines,
            ...(more ? { more } : {}),
            ...(selection ? { selection } : {}),
            ...(caret && on ? { caret: moved(caret) } : {}),
        };
    }

    return { start, settle, read, changes, capture, place };
}

export { ACTIONS };
