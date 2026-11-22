import * as TEXT from './model/reading.js';
import * as LAYOUT from './model/layout.js';
import * as CAMERA from './model/camera.js';
import * as DIALOG from './model/dialog.js';
import { noCount } from './model/routes.js';
import * as DOCK_MODEL from '../dock/model/dock.js';
import * as MODS from '../mods/index.js';

// How many of the marks a document changed at are kept with its count.
const KEPT = 256;
// The knobs of a reading, handed to the reader as they are.
const KNOBS = Object.freeze(['depth', 'roles', 'all', 'items', 'text', 'lines']);
// Those of them that count.
const COUNTS = Object.freeze(['depth', 'items', 'text', 'lines']);
// The buttons of a title bar, as they read.
const BUTTONS = Object.freeze({ close: 'Close', minimize: 'Minimize', zoom: 'Zoom' });
// How many pixels a point a picture is made at, at most.
const SCALE = 4;
// How long a frame is, in ms: the seats are told that the desktop changed at most once in it.
const FRAME = 16;

// What a seat reads of the desktop: the desktop itself, the seats, the Dock and the windows in the seat's order, from
// what the desktop keeps; a window, the parts the shell draws of it and each document it shows as the environment
// reads it; what is under one ref; what changed since a mark; and a picture. Refs: a window is `w<id>`, its parts
// `w<id>.close`, `.minimize`, `.zoom`, `.bar`, `.edge.<name>`, its dialog's `.dialog.<part>` and its picker's
// `.picker` and `.picker.<n>`, an item of the Dock
// `dock.<mod>`, and an element `<document>.<n>`, the same for every seat: `n` as the environment numbers the element,
// and `<document>` a count the shell gives a document as a seat is first told of it, in the order it is listed,
// whichever page answered first. A page that waits on its dialog runs nothing, so it is not read until it is
// answered: its window reads the dialog's parts. The mark is one count for the desktop: it goes up as a line of the
// desktop, or a part of a window's dialog or picker, reads otherwise for some seat, a pointer's place apart, and as a
// document tells that what it shows changed. `READ` reads a page (environment: SHELL `read`), `OVERLAY` is the
// pages' overlays, `web` what the web engine answered, `deckit` what connect answered, and `desk` is what the desktop
// keeps and answers of itself.
export function createReading({ READ, OVERLAY, web, deckit, desk }) {
    // MARK: - Property
    // a document's number as the environment has it -> { page, born, first, pairs }: the mark and the reader's count
    // it was first read at, and the last KEPT marks it changed at, each with its count; a number a seat was told
    // stays the document's while its page shows it, in a window or not
    const documents = new Map();
    const numbers = new WeakMap(); // a page -> the environment's number of the document it shows
    const given = new Map(); // the environment's number of a document a seat was told of -> the number it was told
    const taken = new Map(); // the number a seat was told of a document -> the environment's
    let last = 0;
    const webs = new Set(); // the web pages mods show
    const tracks = new Map(); // seat id -> ref -> { text, born, at }: its desktop lines and the marks they changed at
    // seat id -> ref -> the mark it last went at: what went from a seat's desktop, or from every seat's under null
    const gone = new Map([[null, new Map()]]);
    let mark = 0;
    let telling = false; // whether the seats are told of the mark as the next frame is due

    // What answers each output a seat asks once, by its name.
    const ANSWERS = Object.freeze({
        desktop: (seat, query) => reading(seat, 'desktop', query),
        window: (seat, query) => reading(seat, 'window', query),
        node: (seat, query) => reading(seat, 'node', query),
        changes,
        picture: capture,
    });

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
        for (const seat of [...tracks.keys()]) if (!seen.has(seat)) (tracks.delete(seat), gone.delete(seat));
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

    // An output asked once for `seat`, `of` its name: a reading of the 'desktop', of a 'window' or of a 'node', what
    // 'changes', or a 'picture'. What else is asked is that output's query.
    async function read(seat, { of, ...query } = {}) {
        if (!Object.hasOwn(ANSWERS, of))
            throw refusal('INVALID_ARGUMENT', `what a seat reads is one of ${Object.keys(ANSWERS).join(', ')}`);
        return ANSWERS[of](seat, query);
    }

    // A reading for `seat` at `level`: the 'desktop', a 'window' with `window`, or a 'node' with `ref`, as text or,
    // `format` 'json', as data. The other fields are the knobs, handed to the reader as they are.
    async function reading(seat, level, { window, ref, format = 'text', ...given }) {
        if (!['text', 'json'].includes(format)) throw refusal('INVALID_ARGUMENT', 'a reading is as text or json');
        if (level === 'window' && window === undefined) throw refusal('INVALID_ARGUMENT', 'a window is read by its id');
        if (level === 'node' && ref === undefined) throw refusal('INVALID_ARGUMENT', 'a node is read by its ref');
        counted(given, COUNTS);
        const knobs = Object.fromEntries(
            KNOBS.flatMap((knob) => (given[knob] === undefined ? [] : [[knob, given[knob]]]))
        );
        settle();
        const read =
            level === 'desktop'
                ? desktopOf(seat.id)
                : level === 'window'
                  ? await windowOf(seat.id, idOf(window), knobs)
                  : await nodeOf(seat.id, ref, knobs);
        const data = { ...read, mark };
        return format === 'json' ? { data, mark } : { text: TEXT[level](data), mark };
    }

    // What reads otherwise for `seat` since the mark `since`: the desktop's lines, and the lines of the documents in
    // the windows on its screen that told a change after it. With no mark, the mark now and nothing. Each line and
    // each element is kept with the last mark it changed at, so a mark however old is answered; one above the mark
    // now is refused STALE.
    async function changes(seat, { since = null } = {}) {
        counted({ since }, ['since']);
        settle();
        const from = since ?? mark;
        if (from > mark) throw refusal('STALE', `the desktop never had the mark ${from}: read again`);
        const track = tracks.get(seat.id) ?? new Map();
        const entries = [];
        for (const [ref, line] of linesOf(desktopOf(seat.id))) {
            const { born, at } = track.get(ref);
            if (at > from) entries.push({ kind: born > from ? '+' : '~', line });
        }
        for (const went of [gone.get(null), gone.get(seat.id) ?? new Map()])
            for (const [ref, at] of went) if (at > from && !track.has(ref)) entries.push({ kind: '-', line: ref });
        const ids = [...desk.MANAGER.viewOf(seat.id), ...desk.panelFrames(seat.id).map(({ window }) => window)];
        for (const { id } of ids) {
            for (const { page, part, name, rect, typing } of pagesOf(id)) {
                const number = numbers.get(page);
                const kept = documents.get(number);
                if (!kept || kept.pairs.at(-1).mark <= from) continue;
                if (kept.born > from) {
                    const size = rect ?? { width: 0, height: 0 };
                    const line = `${TEXT.documentLine({ document: toldOf(number), part, name, ...size })} in w${id}`;
                    entries.push({ kind: '+', line });
                    continue;
                }
                // The count the document was at by that mark, or, for a mark older than the pairs kept, the one it
                // was first read at: every element that changed since is told, some that changed before it too.
                const count = kept.pairs.findLast((each) => each.mark <= from)?.count ?? kept.first;
                const answer = await asked(READ.changes(page, { document: number, count }), true);
                if (!answer) continue;
                noted(page, answer.document, answer.count);
                for (const { kind, depth: _depth, ...line } of answer.entries) {
                    const listed = toldLine(line);
                    entries.push({
                        kind,
                        line: kind === '-' ? listed.ref : TEXT.elementLine(withSeats(listed, typing)),
                    });
                }
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
        let of = desk.cameraOf(seat.id);
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

    // Where the pointer of `seat` goes for what `ref` names, once it is scrolled into view: `{ at, by, window }`, `at`
    // the desktop's point at the middle of what shows of it, `by` a point to pass first, the Dock's sliver for an
    // item of the Dock, which brings the Dock out, or null, and `window` the id of the window it is of, or null.
    async function place(seat, ref) {
        const { rect, by = null, window } = await placeOf(seat.id, String(ref), { scrolls: true });
        const at = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        return { at, by, window };
    }

    // MARK: - Private
    function refusal(kind, message) {
        return Object.assign(new Error(message), { stage: 'call', kind });
    }

    // A key of `names` that `given` writes as no count is refused.
    function counted(given, names) {
        const name = noCount(given, names);
        if (name) throw refusal('INVALID_ARGUMENT', `${name} is a count, an integer of 0 or more`);
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
            for (const seat of desk.seated.values()) desk.tells().tell(seat, { of: 'changes', mark });
        }, FRAME);
    }

    function went(seat, ref) {
        if (!gone.has(seat)) gone.set(seat, new Map());
        gone.get(seat).set(ref, mark);
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
        if (had !== undefined && had !== document && documents.delete(had) && given.has(had)) {
            went(null, `document ${given.get(had)}`);
            taken.delete(given.get(had));
            given.delete(had);
        }
        if (!kept) documents.set(document, (kept = { page, born: mark, first: count, pairs: [] }));
        kept.pairs.push({ mark, count });
        if (kept.pairs.length > KEPT) kept.pairs.shift();
    }

    // The number a seat is told of the document the environment numbers `document`: the next count where none was.
    function toldOf(document) {
        if (!given.has(document)) (given.set(document, ++last), taken.set(last, document));
        return given.get(document);
    }

    // An element's line with its ref as a seat is told it.
    function toldLine(line) {
        const [, document, number] = /^(\d+)\.(\d+)$/.exec(line.ref ?? '') ?? [];
        return document === undefined ? line : { ...line, ref: `${toldOf(Number(document))}.${number}` };
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

    // A window or a panel window as `seat` reads it, refused NOT_FOUND for an id none has and for a view that is not
    // on its screen; `names` as namesNow has them.
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
                key: keysOf(id),
                minimized: desk.MANAGER.isMinimized(seat, id),
                zoomed: desk.MANAGER.isZoomed(id),
                tile: desk.MANAGER.tileNameOf(id),
            };
        }
        const panel = desk.panelFrames(seat).find(({ window: { id: each } }) => each === id);
        if (!panel) throw refusal('NOT_FOUND', `no window ${id} is open`);
        const { mod, edge } = panel.window;
        const key = keysOf(id);
        return { kind: 'panel', id: `w${id}`, title: nameOf(mod), mod, edge, frame: { ...panel.frame }, key };
    }

    // The seats whose keyboard the window or panel window `id` holds, in the order they sat, or null where it holds
    // none's.
    function keysOf(id) {
        const seats = desk.keyboardsOf(id);
        return seats.length ? seats : null;
    }

    // The desktop as `seat` reads it, its camera, and the windows that meet the camera or that it minimized, front to
    // back in its order.
    function desktopOf(seat) {
        const items = desk.dock().items();
        const active = desk.windows.get(desk.MANAGER.keyOf(seat))?.mod ?? null;
        const attention = desk.ACTIVATION.attentionOf(seat);
        const camera = desk.cameraOf(seat);
        const seen = (id) => desk.MANAGER.isMinimized(seat, id) || CAMERA.meets(camera, desk.MANAGER.frameOf(id));
        const names = namesNow();
        return {
            desktop: camera,
            seats: [...desk.hands].map(([id, { pointer }]) => ({
                id,
                name: desk.seated.get(id)?.user.name ?? id,
                colour: desk.colourOf(id),
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
            menu: menuOf(seat, items),
            windows: desk.MANAGER.orderOf(seat)
                .reverse()
                .filter(seen)
                .map((id) => factOf(seat, id, names)),
            panels: desk.panelFrames(seat).map(({ window }) => factOf(seat, window.id, names)),
        };
    }

    // The menu of the Dock's item open for `seat`, `{ name, entries: [{ id, name, ref, rect }] }`, `name` its item's
    // among `items`, each entry with its label and its rect on the desktop; or null with none open.
    function menuOf(seat, items) {
        const menu = desk.dockMenu(seat);
        if (!menu) return null;
        const entries = menu.entries.map(({ id, label, rect }) => ({ id, name: label, ref: `dock-menu.${id}`, rect }));
        return { name: items.find(({ id }) => id === menu.item)?.name ?? menu.item, entries };
    }

    // The desktop's lines by ref, in the order they read; `held` as they are held against what was read before, a
    // seat's line without where its pointer is and whose it is.
    function linesOf({ desktop, seats, dock, menu, windows, panels }, { held = false } = {}) {
        const seat = (each) => TEXT.seatLine(held ? { ...each, at: null, you: false } : each);
        return new Map([
            ['desktop', `desktop at ${desktop.x},${desktop.y} ${desktop.width}x${desktop.height}`],
            ...seats.map((each) => [each.id, seat(each)]),
            ...dock.map((item) => [item.ref, TEXT.itemLine(item)]),
            ...(menu?.entries ?? []).map((entry) => [entry.ref, TEXT.entryLine(entry)]),
            ...[...windows, ...panels].flatMap((window) => [
                [window.id, TEXT.windowLine(window)],
                ...[...dialogPartsOf(idOf(window.id)), ...pickerPartsOf(idOf(window.id))]
                    .filter(({ ref }) => ref)
                    .map((part) => [part.ref, TEXT.elementLine(part)]),
            ]),
        ]);
    }

    // The pages a window or a panel window shows, bottom to top: `{ page, part, name, rect, typing }`, `part` its
    // 'content', a 'child' a region of it shows, named by its mod, a 'web' page in one of them or an 'overlay' of one,
    // `rect` where it is on the desktop, which the shell is not told of a web page, and `typing` the seats whose keys
    // go to it. A page that waits on its dialog is left out.
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
        return [...laid, ...inside]
            .filter(({ page }) => !desk.waits(page))
            .map((each) => ({ name: null, ...each, typing: desk.typingIn(each.page) }));
    }

    // A line of a document with the seats whose keys go to it after `focused`, in the order they sat.
    function withSeats(line, seats) {
        if (!seats.length || !line.states?.includes('focused')) return line;
        const focused = ['focused', ...seats].join(' ');
        return { ...line, states: line.states.map((state) => (state === 'focused' ? focused : state)) };
    }

    // The documents are numbered in the order they are listed, as the pages answer in any order.
    async function windowOf(seat, id, knobs) {
        const own = factOf(seat, id);
        const pages = pagesOf(id);
        const outlines = await Promise.all(pages.map(({ page }) => asked(READ.outline(page, knobs), true)));
        const documents = pages.flatMap(({ page, part, name, typing }, at) => {
            const outline = outlines[at];
            if (!outline) return [];
            noted(page, outline.document, outline.count);
            const { width, height } = outline;
            const document = toldOf(outline.document);
            const lines = outline.lines.map((line) => withSeats(toldLine(line), typing));
            return [{ document, part, ...(name ? { name } : {}), width, height, lines }];
        });
        return { window: own, parts: partsOf(id).map(({ rect: _rect, ...part }) => part), documents };
    }

    // The parts of a normal window the shell draws that are listed: the buttons of its title bar, and its bar, the
    // top of its frame, named by its title: a press there brings the window forward and a drag from there moves it;
    // then its dialog's parts and its picker's. `depth` counts the levels under the window's own, from 0, and `rect`
    // is on the desktop.
    function partsOf(id) {
        const window = desk.windows.get(id);
        if (!window) return [];
        const frame = desk.MANAGER.frameOf(id);
        const { bar } = window;
        const buttons = LAYOUT.buttonsOf(bar).map(({ name, x, y, width, height }) => ({
            depth: 0,
            role: 'button',
            name: BUTTONS[name],
            states: bar.enabled[name] ? [] : ['disabled'],
            ref: `w${id}.${name}`,
            rect: { x: frame.x + x, y: frame.y + y, width, height },
        }));
        const rect = { x: frame.x, y: frame.y, width: frame.width, height: bar.height };
        const name = window.title ? { name: window.title } : {};
        const titled =
            bar.height > 0 ? [{ depth: 0, role: 'titlebar', ...name, states: [], ref: `w${id}.bar`, rect }] : [];
        return [...buttons, ...titled, ...dialogPartsOf(id), ...pickerPartsOf(id)];
    }

    // The parts of the dialog up last in the normal window `id`: who asks and the message as text, a prompt's field
    // with its text, and the buttons left to right, each `w<id>.dialog.<part>`, `rect` on the desktop.
    function dialogPartsOf(id) {
        const dialog = desk.windows.has(id) && desk.dialogsIn(id).filter(DIALOG.waitsOn).at(-1);
        if (!dialog) return [];
        const frame = desk.MANAGER.frameOf(id);
        const { from, message, field, buttons } = DIALOG.partsOf(dialog);
        const part = (role, name, states, rect, at) => {
            const on = { x: frame.x + rect.x, y: frame.y + rect.y, width: rect.width, height: rect.height };
            return { depth: 0, role, ...(name === null ? {} : { name }), states, ref: `w${id}.dialog.${at}`, rect: on };
        };
        return [
            part('text', String(dialog.from), [], from, 'from'),
            part('text', String(dialog.message), [], message, 'message'),
            ...(field ? [part('textbox', null, [valueOf(dialog.value)], field, 'field')] : []),
            ...buttons.map(({ name, label, rect }) => part('button', label, [], rect, name)),
        ];
    }

    // The picker opened last in the normal window `id`: its listbox `w<id>.picker`, named by its control, and under it
    // each of its options in order, `w<id>.picker.<n>` from 1, an option of a group under the group's line, which has
    // no ref; `rect` on the desktop.
    function pickerPartsOf(id) {
        const picker = desk.windows.has(id) && desk.dialogsIn(id).findLast((one) => !DIALOG.waitsOn(one));
        if (!picker) return [];
        const frame = desk.MANAGER.frameOf(id);
        const on = ({ x, y, width, height }) => ({ x: frame.x + x, y: frame.y + y, width, height });
        const { list, rows } = DIALOG.partsOf(picker);
        const ref = `w${id}.picker`;
        return [
            { depth: 0, role: 'listbox', name: picker.name, states: [], ref, rect: on(list) },
            ...rows.map(({ rect, group, index, label, disabled, selected, grouped }) =>
                group !== undefined
                    ? { depth: 1, role: 'group', name: group, states: [], rect: on(rect) }
                    : {
                          depth: grouped ? 2 : 1,
                          role: 'option',
                          name: label,
                          states: [disabled && 'disabled', selected && 'selected'].filter(Boolean),
                          ref: `${ref}.${index + 1}`,
                          rect: on(rect),
                      }
            ),
        ];
    }

    // A field's value as the environment reads one: its white space runs made one space and its ends trimmed, cut to
    // 40 characters, with how many it holds where it is cut.
    function valueOf(text) {
        const whole = String(text).replace(/\s+/g, ' ').trim();
        if (whole.length <= 40) return `value ${JSON.stringify(whole)}`;
        return `value ${JSON.stringify(`${whole.slice(0, 40)}…`)} (${whole.length})`;
    }

    // A part the shell draws, by its ref, with `rect` on the desktop, the window it is of, and for an item of the Dock
    // `by`, the middle of the Dock's sliver; or null for a ref that names none. An entry of the Dock's menu is one
    // while that menu is open for the seat.
    function partOf(seat, ref) {
        if (ref.startsWith('dock-menu.')) {
            const entry = desktopOf(seat).menu?.entries.find((each) => each.ref === ref);
            return entry ? { line: { role: 'menuitem', name: entry.name, ref }, rect: entry.rect, window: null } : null;
        }
        const [, mod] = /^dock\.(.+)$/.exec(ref) ?? [];
        if (mod !== undefined) {
            const items = desk.dock().items();
            const item = desktopOf(seat).dock.find(({ id }) => id === mod);
            if (!item) return null;
            const [sliver] = DOCK_MODEL.inputOf(desk.area(seat), true, items);
            const by = { x: sliver.x + sliver.width / 2, y: sliver.y + sliver.height / 2 };
            const states = ['running', 'active', 'attention'].filter((state) => item[state]);
            const line = { role: 'item', name: item.name, states, ref };
            return { line, rect: DOCK_MODEL.tileOf(desk.area(seat), items, mod), window: null, by };
        }
        const [, window, name, edge] =
            /^w(\d+)\.(close|minimize|zoom|bar|dialog\.[a-z]+|picker(?:\.\d+)?|edge\.([a-z-]+))$/.exec(ref) ?? [];
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

    // The page whose document has the element `ref` names, with the ref as the environment has it and where the page
    // is on the desktop: refused GONE for a ref no document here has.
    function pageOf(ref) {
        const [, number, element] = /^(\d+)\.(\d+)$/.exec(ref) ?? [];
        const document = taken.get(Number(number));
        const kept = documents.get(document);
        const window = kept && desk.windowAt(kept.page);
        if (!window) throw refusal('GONE', 'nothing read here has that ref');
        if (desk.waits(kept.page)) throw refusal('REFUSED', 'its page waits on its dialog, which is answered first');
        const { rect, typing } = pagesOf(window.id).find(({ page }) => page === kept.page) ?? {};
        const inPage = `${document}.${element}`;
        return { page: kept.page, ref: inPage, window: window.id, rect: rect ?? null, typing: typing ?? [] };
    }

    // Where what `ref` names is on the desktop, `{ rect, window, by }`, what shows of an element in its page; with
    // `scrolls`, once it is scrolled into view.
    async function placeOf(seat, ref, { scrolls }) {
        const part = partOf(seat, ref);
        if (part) return part;
        const { page, ref: named, window, rect: on } = pageOf(ref);
        if (!on) throw refusal('REFUSED', 'where a web page lies on the desktop is not told yet');
        const inPage = scrolls ? await asked(READ.place(page, named)) : (await asked(READ.node(page, named, {}))).rect;
        const left = Math.max(0, inPage.x);
        const top = Math.max(0, inPage.y);
        const width = Math.max(1, Math.min(on.width, inPage.x + inPage.width) - left);
        const height = Math.max(1, Math.min(on.height, inPage.y + inPage.height) - top);
        return { rect: { x: on.x + left, y: on.y + top, width, height }, window };
    }

    async function nodeOf(seat, ref, knobs) {
        const part = partOf(seat, ref);
        if (part) return { node: part.line, rect: part.rect };
        const { page, ref: named, rect: on, typing } = pageOf(ref);
        const answer = await asked(READ.node(page, named, knobs));
        noted(page, answer.document, answer.count);
        const { line, rect, scroll, lines: under, more, selection, caret, selected } = answer;
        const lines = under.map(toldLine);
        const moved = (each) => (on ? { ...each, x: on.x + each.x, y: on.y + each.y } : null);
        return {
            node: withSeats(toldLine(line), typing),
            ...(on ? { rect: moved(rect) } : { size: { width: rect.width, height: rect.height } }),
            ...(scroll ? { scroll } : {}),
            lines,
            ...(more ? { more } : {}),
            ...(selection ? { selection } : {}),
            ...(caret && on ? { caret: moved(caret) } : {}),
            ...(selected && on ? { selected: selected.map(moved) } : {}),
        };
    }

    return { start, settle, read, place };
}
