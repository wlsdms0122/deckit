import * as CHANNEL from '../deck/channel/index.js';
import * as DECLARED from './protocol.js';

export function createTheme({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    let theme = null; // the host app's, or null until it gives one
    const pages = new Set(); // the pages that drew in it, each told when it changes

    // MARK: - Initializer
    // MARK: - Public
    // `draws(page)`: whether a page is one the shell draws in.
    function start({ draws }) {
        PROTOCOL.setup.handle((_payload, sender) => {
            if (!draws(sender)) throw Object.assign(new Error('only a deckit page draws'), { kind: 'REFUSED' });
            if (!pages.has(sender)) {
                pages.add(sender);
                // A page that loads again leaves until its new document asks for the theme, and comes back then.
                deckit.pages.whenEnds(sender, () => pages.delete(sender));
            }
            return { theme };
        });
    }

    // A new theme goes to every page that drew in the one before, which takes it in place.
    function set(next) {
        if (JSON.stringify(next) === JSON.stringify(theme)) return;
        theme = next;
        for (const page of pages) PROTOCOL.change.send(page, { theme });
    }

    // MARK: - Private

    return { start, set };
}
