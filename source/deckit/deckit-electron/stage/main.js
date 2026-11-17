// Where a layer on deckit lays pages in a window of the app's: a stage it places in the window, and the pages on it,
// each where it is or hidden, drawn in the order laid. Which pages, in what order and where, is the layer's; the web
// pages a page shows are laid just over it, each over the element that holds its place and cut to the page and to
// what the page is cut to (`webPagesIn(page)`, `[{ page, frame }]`, `frame` in the page), taking no pointer where the
// page takes none. `idOf(window)` is a window's in the module.
import { hitIn } from './hit.js';

export function createStages({ LOG, WEBKIT, idOf, webPagesIn }) {
    // MARK: - Property
    const showing = new WeakMap(); // page -> the stage it is shown on, a page of deck's or a web page

    // MARK: - Initializer
    // MARK: - Public
    function stage() {
        const native = WEBKIT.native();
        const id = native.makeStage();
        const resized = new Set(); // listener()
        let laid = []; // what the layer laid last
        let at = null; // { window, bounds, unheard }: the window it is placed in
        let frame = { x: 0, y: 0, width: 0, height: 0 };
        let closed = false;

        // Into one of the app's windows: `bounds`, a rect or a function of the window's content size; `front`, over
        // what is in the window already; `onClose()`, once it is out of a closing window.
        function place(window, { bounds = null, front = false, onClose = null } = {}) {
            if (closed) return;
            if (at?.window !== window) {
                at?.unheard();
                const unheard = [
                    window.on('resize', () => fit({ front: false })),
                    window.on('close', () => {
                        at = null;
                        lay([]);
                        onClose?.();
                    }),
                ];
                at = { window, bounds, unheard: () => unheard.forEach((off) => off()) };
            }
            at.bounds = bounds;
            fit({ front });
        }

        // The stage's size, as it is laid in its window.
        function size() {
            return { width: frame.width, height: frame.height };
        }

        // Heard each time the stage changes size: answers its off.
        function whenResized(listener) {
            resized.add(listener);
            return () => resized.delete(listener);
        }

        function show(on) {
            if (!closed) native.showStage(id, !!on);
        }

        // What is on the stage: each layer `{ page, rect, clip, input, opacity, scale }`, laid there, drawn only
        // inside `clip`, a rect on the stage with its corners rounded by `cornerRadius`, where it is given, taking the
        // pointer only inside the rects `input` names in it where it names any, drawn at `opacity`, 1 where it is not
        // given, and drawn scaled as `scale`, `{ by, x, y }`, has it where it is given, what is at p on the stage
        // drawn at p * by + (x, y), the page laid at its rect all the same, or `{ page, hidden: true }`, kept out of
        // the window, which a page in it would slow as it resizes, or `{ material, rect, cornerRadius }`, a material of
        // the host's named as a window's is, blurring what the window shows under the rect, the layers before it
        // included, and taking no clicks. The layers are in the order given, bottom to top. A page left out, or gone,
        // is taken off. Each page is clear where it draws nothing.
        function lay(layers) {
            if (closed) return;
            for (const { page, material = null, rect = null, hidden = false } of layers)
                if (material ? page || !rect || typeof material !== 'string' : !rect === !hidden || !page)
                    throw new Error(
                        '[deckit] a layer is { page, rect }, { page, hidden: true } or { material, rect, cornerRadius }'
                    );
            laid = layers.filter(({ page }) => !page?.isDestroyed());
            relay();
        }

        // The page a press at `point` of the stage reaches were `layers` what is laid, as `lay` takes them, read from
        // the list and from no view, so for an order that is not the one shown too: `{ page, x, y }`, the point from
        // that page's top left, a web page a page shows answered as itself, or null where it reaches none.
        function hit(layers, point) {
            const found = hitIn(
                layersOf(layers, () => {}),
                point
            );
            return found && { ...found, page: WEBKIT.pageById(found.page) };
        }

        // `rect` of the stage, all of it where none is given, as it would be seen were `layers` what is laid, as `lay`
        // takes them: a Promise of a PNG, `scale` pixels a point, 1 where it is not given, made from what each page
        // draws and from no window, so for an order that is not the one shown too. A page is drawn where it is laid,
        // cut and scaled as laid; a material is drawn as on a screen, what is under it in the picture blurred within
        // its rect, rounded by its radius; a hidden page leaves nothing in it.
        function capture(layers, { rect = null, scale = 1 } = {}) {
            const of = layersOf(layers, () => {});
            return native
                .capture(of, { rect: rect ?? { x: 0, y: 0, ...size() }, scale })
                .then((png) => Buffer.from(png, 'base64'));
        }

        // The stage ended: its pages taken off and it out of its window.
        function close() {
            if (closed) return;
            lay([]);
            at?.unheard();
            at = null;
            closed = true;
            native.removeStage(id);
        }

        // MARK: - Private
        function fit({ front }) {
            if (!at || at.window.isClosed()) return;
            const content = at.window.size();
            const bounds = typeof at.bounds === 'function' ? at.bounds(content) : at.bounds;
            const next = bounds || { x: 0, y: 0, ...content };
            const changed = next.width !== frame.width || next.height !== frame.height;
            frame = next;
            native.placeStage(id, { window: idOf(at.window), frame, front });
            if (changed)
                for (const listener of [...resized]) {
                    try {
                        listener();
                    } catch (error) {
                        LOG.error("a stage's resize failed", error);
                    }
                }
        }

        // The pages as laid, each page's web pages just over it, cut to the page's clip and its rect.
        function relay() {
            for (const page of record.shown) if (showing.get(page) === record) showing.delete(page);
            record.shown.clear();
            const show = (page) => {
                showing.set(page, record);
                record.shown.add(page);
            };
            native.layStage(id, layersOf(laid, show));
        }

        // `layers` as the native side lays them, each page's web pages just over it, `show(page)` told each page
        // that has a place among them.
        function layersOf(layers, show) {
            return layers.flatMap(({ page, material, rect, clip, input, opacity, scale, cornerRadius = 0 }) => {
                if (material) return [{ material, frame: rect, cornerRadius }];
                if (page.isDestroyed()) return [];
                if (!rect) return [{ page: page.id, hidden: true }];
                show(page);
                const clips = clip ? [clip] : [];
                const seen = drawnAs(opacity, scale);
                const none = input && !input.length ? { input: [] } : {};
                const over = webPagesIn(page).map((web) => {
                    show(web.page);
                    const { x, y, width, height } = web.frame;
                    const frame = { x: rect.x + x, y: rect.y + y, width, height };
                    return { page: web.page.id, frame, clips: [...clips, rect], ...none, ...seen };
                });
                return [
                    { page: page.id, frame: rect, ...(clip ? { clips } : {}), ...(input ? { input } : {}), ...seen },
                    ...over,
                ];
            });
        }

        // How a page laid at `opacity` and `scale` is told to the native side: each left out where it draws it as laid.
        function drawnAs(opacity, scale) {
            const seen = opacity !== undefined && opacity < 1 ? { opacity: Math.max(0, opacity) } : {};
            if (!scale || ![scale.by, scale.x, scale.y].every(Number.isFinite) || scale.by <= 0) return seen;
            const { by, x, y } = scale;
            return by === 1 && !x && !y ? seen : { ...seen, scale: { by, x, y } };
        }

        const record = { relay, window: () => at?.window || null, shown: new Set() };
        return Object.freeze({ place, size, whenResized, show, lay, hit, capture, close });
    }

    // A page's web pages moved, came or went: the stage it is shown on lays them again.
    function relayOf(page) {
        showing.get(page)?.relay();
    }

    // The window a page is shown in, or null.
    function windowShowing(page) {
        return showing.get(page)?.window() || null;
    }

    // MARK: - Private

    return { stage, relayOf, windowShowing };
}
