import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as SURFACE from './model/surface.js';

// The overlay over each page the shell draws in, a mod's or its own: a document the page opens beside itself, where
// the kit draws what floats over the page, so it is over everything laid with the page, web pages too. Whatever lays
// the page lays its overlay at the same rect, over all it lays, while the overlay shows anything (`over`). While a
// layer is open the keyboard the page has, or is given, is the overlay's, and the page has it back once the last
// layer closes. `deckit` is what connect answered, and `PAGES` the shell's pages.
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

    // The overlay to lay over `page`, while it shows anything, or null.
    function over(page) {
        const held = overlays.get(page);
        return held?.shows && held.surface && PAGES.isAlive(held.surface) ? held.surface : null;
    }

    // Whether a layer is open over `page`.
    function layered(page) {
        return !!overlays.get(page)?.layered;
    }

    function holdsKeyboard(page) {
        const surface = overlays.get(page)?.surface;
        return !!surface && PAGES.isAlive(surface) && deckit.web.holdsKeyboard(surface);
    }

    // The page whose overlay `surface` is, or null.
    function pageOf(surface) {
        for (const [page, held] of overlays) if (held.surface === surface) return page;
        return null;
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
            PAGES.whenFocused(page, () => held.layered && overlays.get(page) === held && focusOverlay(held));
        }
        setState(page, { shows: false, layered: false });
        PAGES.allowSurface(page, SURFACE.NAME, (surface) => {
            if (overlays.get(page) !== held) return PAGES.close(surface);
            held.surface = surface;
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
        if (on && !was.layered && deckit.web.holdsKeyboard(page)) focusOverlay(held);
        if (!on && was.layered && holdsKeyboard(page)) PAGES.focus(page);
    }

    function focusOverlay(held) {
        if (held.surface && PAGES.isAlive(held.surface)) PAGES.focus(held.surface);
    }

    function tell(page) {
        for (const listener of [...listeners]) listener(page);
    }

    return { start, over, layered, holdsKeyboard, pageOf, onChange };
}
