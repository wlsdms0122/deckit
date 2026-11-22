import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/overlay/protocol.js';
import * as SURFACE from './model/surface.js';

// The overlay over each page the shell draws in, a mod's or its own: a document the page opens beside itself, where the
// kit draws the page's layers, so they are over everything laid with the page, web pages too. It is the page's:
// whatever lays the page lays its overlay at the same rect, or at a wider one it names, over all it lays, while the
// overlay shows anything (`withOverlays`), with a material just under it where what it draws is glass, and what asks
// whose a page is asks `ownerOf`. The page hears where its overlay is laid, from its own top left. It takes the
// pointer where it draws what takes it. It has the keyboard while an element drawn in it has it, once the person
// presses there or the page gives its keyboard for an element focused there; the page has it again once that is not
// so. Its keys reach the keys of the app as the page's.
// `deckit` is what connect answered, `web` what the web engine answered (`holdsKeyboard`), `PAGES` the shell's pages,
// and `KEY` the keys of the app.
export function createOverlay({ deckit, web, PAGES, KEY }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const overlays = new Map(); // a page -> { surface, shows, focused, regions, materials, told }, once the page asked
    const listeners = new Set();
    let keyboardOf = null;
    const NOTHING = Object.freeze({ shows: false, focused: false, regions: [], materials: [] });

    // MARK: - Initializer
    // MARK: - Public
    // `keyboardOf(page)` is the document of the page's that takes its keyboard back from its overlay.
    function start(given) {
        keyboardOf = given.keyboardOf;
        PROTOCOL.open.handle((_payload, sender) => open(sender));
        PROTOCOL.state.on((state, sender) => setState(sender, state));
        PROTOCOL.take.on((_payload, sender) => take(sender));
    }

    // What is laid (STAGE.lay), and over it the overlay of each page laid that shows anything, at the page's rect and
    // cut to its clip, or at its `spread`, a wider rect on the stage, taking the pointer where it draws what takes it,
    // each over the materials of what it draws as glass, cut to it. Each page laid with an overlay hears where that is.
    function withOverlays(laid) {
        const over = laid.flatMap(({ page, rect, clip, spread }) => {
            if (!page || !rect) return [];
            const at = spread ?? rect;
            tellFrame(page, { x: at.x - rect.x, y: at.y - rect.y, width: at.width, height: at.height });
            const surface = shownOver(page);
            if (!surface) return [];
            const { regions, materials } = overlays.get(page);
            const cut = clip && !spread ? { clip } : {};
            return [
                ...materials.flatMap((each) => materialIn(at, each)),
                { page: surface, rect: at, ...cut, input: regions },
            ];
        });
        return [...laid.map(({ spread: _spread, ...each }) => each), ...over];
    }

    // The page `page` is: itself, or the page whose overlay it is.
    function ownerOf(page) {
        for (const [owner, held] of overlays) if (held.surface === page) return owner;
        return page;
    }

    // `listener(page)` hears `page`'s overlay change how it is laid: answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    // Each document of the page asks as it starts. One loaded again in its place finds the overlay the last one
    // opened, by its name, and draws it anew; a page that crashed or went takes its overlay with it.
    function open(page) {
        if (!deckit.mods.modOf(page) && !deckit.pages.nameOf(page))
            throw new Error('[deckit] an overlay is for a page the shell draws in');
        let held = overlays.get(page);
        if (!held) {
            held = { surface: null, ...NOTHING };
            overlays.set(page, held);
        }
        setState(page, NOTHING);
        held.told = null;
        PAGES.allowSurface(page, SURFACE.NAME, (surface) => {
            if (overlays.get(page) !== held) return PAGES.close(surface);
            held.surface = surface;
            KEY.listen(surface, page);
        });
        deckit.pages.whenEnds(page, ({ replaced }) => {
            if (overlays.get(page) !== held) return;
            setState(page, NOTHING);
            if (replaced) return;
            overlays.delete(page);
            if (held.surface) PAGES.close(held.surface);
        });
        return SURFACE.NAME;
    }

    function setState(page, { shows, focused, regions, materials = [] }) {
        const held = overlays.get(page);
        if (!held) return;
        const was = JSON.stringify([held.shows, held.regions, held.materials]);
        Object.assign(held, {
            shows,
            focused,
            regions: regions.flatMap(rectOf),
            materials: materials.flatMap(materialOf),
        });
        if (was !== JSON.stringify([held.shows, held.regions, held.materials])) tell(page);
        giveBack(page, held);
    }

    // The keyboard `page` has, or a web page in it, goes to its overlay, for an element focused there.
    function take(page) {
        const held = overlays.get(page);
        if (held?.shows && web.holdsKeyboard(page)) focusOverlay(held);
    }

    // The overlay to lay over `page`, while it shows anything, or null.
    function shownOver(page) {
        const held = overlays.get(page);
        return held?.shows && held.surface && PAGES.isAlive(held.surface) ? held.surface : null;
    }

    // Whether the overlay may keep the keyboard: an element drawn in it has the keyboard.
    function mayHold({ shows, focused }) {
        return shows && focused;
    }

    // An overlay with the keyboard it may not keep, as one pressed where nothing takes the focus, gives it back to its
    // page, where the page takes it: the overlay tells what it holds after each press.
    function giveBack(page, held) {
        if (!mayHold(held) && overlayHoldsKeyboard(held)) PAGES.focus(keyboardOf(page));
    }

    function overlayHoldsKeyboard(held) {
        return !!held?.surface && PAGES.isAlive(held.surface) && web.holdsKeyboard(held.surface);
    }

    function focusOverlay(held) {
        if (held.surface && PAGES.isAlive(held.surface)) PAGES.focus(held.surface);
    }

    // `page` hears where its overlay is laid, from its own top left, as that changes.
    function tellFrame(page, frame) {
        const held = overlays.get(page);
        const written = JSON.stringify(frame);
        if (!held || held.told === written) return;
        held.told = written;
        PROTOCOL.frame.send(page, frame);
    }

    // A rect a page told, as numbers, or none.
    function rectOf(rect) {
        const { x, y, width, height } = rect || {};
        return [x, y, width, height].every(Number.isFinite) ? [{ x, y, width, height }] : [];
    }

    // A material a page told, as a material's name, a rect and a radius, or none.
    function materialOf(told) {
        const radius = Number.isFinite(told?.cornerRadius) ? Math.max(0, told.cornerRadius) : 0;
        return typeof told?.material === 'string'
            ? rectOf(told).map((rect) => ({ material: told.material, rect, cornerRadius: radius }))
            : [];
    }

    // The material `{ material, rect, cornerRadius }` from the top left of an overlay laid at `at`, on the stage and
    // cut to `at`, or none where nothing of it is in it.
    function materialIn(at, { material, rect, cornerRadius }) {
        const x = Math.max(at.x, at.x + rect.x);
        const y = Math.max(at.y, at.y + rect.y);
        const right = Math.min(at.x + at.width, at.x + rect.x + rect.width);
        const bottom = Math.min(at.y + at.height, at.y + rect.y + rect.height);
        if (right <= x || bottom <= y) return [];
        return [{ material, rect: { x, y, width: right - x, height: bottom - y }, cornerRadius }];
    }

    function tell(page) {
        for (const listener of [...listeners]) listener(page);
    }

    return { start, withOverlays, ownerOf, onChange };
}
