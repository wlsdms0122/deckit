import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as SURFACE from './model/surface.js';

// The overlay over each page the shell draws in, a mod's or its own: a document the page opens beside itself, where
// the kit draws what floats over the page, so it is over everything laid with the page, web pages too. It is the
// page's: whatever lays the page lays its overlay at the same rect, over all it lays, while the overlay shows anything
// (`withOverlays`), and what asks whose a page is asks `ownerOf`. The overlay has the keyboard only while it shows a
// layer: the keyboard the page has, or is given, is the overlay's then, and the page's again once it is not. Its keys
// reach the key map as those of a page that is no mod's: a key of the page's own does not run behind a layer.
// `deckit` is what connect answered, and `PAGES` the shell's pages.
export function createOverlay({ deckit, PAGES }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const overlays = new Map(); // a page -> { surface, shows, layered }, once the page asked for its overlay
    const listeners = new Set();

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle((_payload, sender) => open(sender));
        PROTOCOL.state.on((state, sender) => setState(sender, state));
    }

    // What is laid (STAGE.lay), and over it the overlay of each page laid that shows anything, at the page's rect.
    function withOverlays(laid) {
        const over = laid
            .filter(({ rect }) => rect)
            .map(({ page, rect }) => ({ page: shownOver(page), rect }))
            .filter(({ page }) => page);
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

    // `listener(page)` hears whether `page`'s overlay shows change: answers its off.
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
            held = { surface: null, shows: false, layered: false };
            overlays.set(page, held);
            PAGES.whenFocused(page, () => overlays.get(page) === held && holdsLayer(held) && focusOverlay(held));
        }
        setState(page, { shows: false, layered: false });
        PAGES.allowSurface(page, SURFACE.NAME, (surface) => {
            if (overlays.get(page) !== held) return PAGES.close(surface);
            held.surface = surface;
            deckit.keymap.listen(surface);
            PAGES.whenFocused(surface, () => overlays.get(page) === held && giveBack(page, held));
        });
        deckit.pages.whenEnds(page, ({ replaced }) => {
            if (overlays.get(page) !== held) return;
            setState(page, { shows: false, layered: false });
            if (replaced) return;
            overlays.delete(page);
            if (held.surface) PAGES.close(held.surface);
        });
        return SURFACE.NAME;
    }

    function setState(page, { shows, layered: on }) {
        const held = overlays.get(page);
        if (!held) return;
        const was = { ...held };
        held.shows = shows;
        held.layered = on;
        if (was.shows !== shows) tell(page);
        if (holdsLayer(held) && !holdsLayer(was) && deckit.web.holdsKeyboard(page)) focusOverlay(held);
        giveBack(page, held);
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

    // An overlay with the keyboard and no layer, as one pressed while a layer fades out, gives it to its page.
    function giveBack(page, held) {
        if (!holdsLayer(held) && overlayHoldsKeyboard(held)) PAGES.focus(page);
    }

    function overlayHoldsKeyboard(held) {
        return !!held?.surface && PAGES.isAlive(held.surface) && deckit.web.holdsKeyboard(held.surface);
    }

    function focusOverlay(held) {
        if (held.surface && PAGES.isAlive(held.surface)) PAGES.focus(held.surface);
    }

    function tell(page) {
        for (const listener of [...listeners]) listener(page);
    }

    return { start, withOverlays, layered, holdsKeyboard, ownerOf, onChange };
}
