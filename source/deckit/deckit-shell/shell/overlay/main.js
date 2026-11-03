import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as SURFACE from './model/surface.js';

// The overlay over each page the shell draws in, a mod's or its own: a document the page opens beside itself, where the
// kit draws what floats over the page, so it is over everything laid with the page, web pages too. It is the page's:
// whatever lays the page lays its overlay at the same rect, over all it lays, while the overlay shows anything
// (`withOverlays`), and what asks whose a page is asks `ownerOf`. It takes the pointer where it draws, and all of it
// over the page while it shows a layer. It has the keyboard while it shows a layer, the keyboard the page has or is
// given being the overlay's then, and while an element drawn in it has it, once the person presses there or the page
// gives its keyboard for an element focused there; the page has it again once neither is so. Its keys reach the key map
// as the page's, and as those of a page that is no mod's while a layer is open: a key of the page's own does not run
// behind a layer. `deckit` is what connect answered, and `PAGES` the shell's pages.
export function createOverlay({ deckit, PAGES }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const overlays = new Map(); // a page -> { surface, shows, layered, focused, regions }, once the page asked for it
    const listeners = new Set();
    const NOTHING = Object.freeze({ shows: false, layered: false, focused: false, regions: [] });

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle((_payload, sender) => open(sender));
        PROTOCOL.state.on((state, sender) => setState(sender, state));
        PROTOCOL.take.on((_payload, sender) => take(sender));
    }

    // What is laid (STAGE.lay), and over it the overlay of each page laid that shows anything, at the page's rect,
    // taking the pointer where it draws, or over all of it while it shows a layer.
    function withOverlays(laid) {
        const over = laid.flatMap(({ page, rect }) => {
            const surface = rect && shownOver(page);
            if (!surface) return [];
            const held = overlays.get(page);
            return [holdsLayer(held) ? { page: surface, rect } : { page: surface, rect, input: held.regions }];
        });
        return [...laid, ...over];
    }

    // Whether a layer is open in `page`, drawn in its overlay or not (a drag carrying nothing drawn).
    function layered(page) {
        return !!overlays.get(page)?.layered;
    }

    // Whether `page` has the keyboard: itself, a web page in it or its overlay.
    function holdsKeyboard(page) {
        return deckit.web.holdsKeyboard(page) || overlayHoldsKeyboard(overlays.get(page));
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
            PAGES.whenFocused(page, () => overlays.get(page) === held && holdsLayer(held) && focusOverlay(held));
        }
        setState(page, NOTHING);
        PAGES.allowSurface(page, SURFACE.NAME, (surface) => {
            if (overlays.get(page) !== held) return PAGES.close(surface);
            held.surface = surface;
            deckit.keymap.listen(surface, { belongsTo: () => (holdsLayer(held) ? null : page) });
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

    function setState(page, { shows, layered: on, focused, regions }) {
        const held = overlays.get(page);
        if (!held) return;
        const was = { ...held };
        Object.assign(held, { shows, layered: on, focused, regions: regions.flatMap(rectOf) });
        if (was.shows !== shows || was.layered !== on || JSON.stringify(was.regions) !== JSON.stringify(held.regions))
            tell(page);
        if (holdsLayer(held) && !holdsLayer(was) && deckit.web.holdsKeyboard(page)) focusOverlay(held);
        giveBack(page, held);
    }

    // The keyboard `page` has, or a web page in it, goes to its overlay, for an element focused there.
    function take(page) {
        const held = overlays.get(page);
        if (held?.shows && deckit.web.holdsKeyboard(page)) focusOverlay(held);
    }

    // The overlay to lay over `page`, while it shows anything, or null.
    function shownOver(page) {
        const held = overlays.get(page);
        return held?.shows && held.surface && PAGES.isAlive(held.surface) ? held.surface : null;
    }

    // Whether the overlay is laid with a layer open in it, which then has the keys.
    function holdsLayer({ shows, layered: on }) {
        return shows && on;
    }

    // Whether the overlay may keep the keyboard: it shows a layer, or an element drawn in it has the keyboard.
    function mayHold({ shows, layered: on, focused }) {
        return shows && (on || focused);
    }

    // An overlay with the keyboard it may not keep, as one pressed where nothing takes the focus, gives it to its page:
    // the overlay tells what it holds after each press.
    function giveBack(page, held) {
        if (!mayHold(held) && overlayHoldsKeyboard(held)) PAGES.focus(page);
    }

    function overlayHoldsKeyboard(held) {
        return !!held?.surface && PAGES.isAlive(held.surface) && deckit.web.holdsKeyboard(held.surface);
    }

    function focusOverlay(held) {
        if (held.surface && PAGES.isAlive(held.surface)) PAGES.focus(held.surface);
    }

    // A rect a page told, as numbers, or none.
    function rectOf(rect) {
        const { x, y, width, height } = rect || {};
        return [x, y, width, height].every(Number.isFinite) ? [{ x, y, width, height }] : [];
    }

    function tell(page) {
        for (const listener of [...listeners]) listener(page);
    }

    return { start, withOverlays, layered, holdsKeyboard, ownerOf, onChange };
}
