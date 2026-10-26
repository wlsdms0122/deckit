import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as FONTS from './model/fonts.js';
import * as FONTS_PERMISSION from './model/permission.js';

// `deckit` is what connect answered.
export function createFonts({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const KEPT = 'fonts';
    let fonts = FONTS.DEFAULT;

    // MARK: - Initializer
    // MARK: - Public
    // The person's fonts, kept in the shell's state, which a mod with deckit.fonts reads and changes.
    // `onChange(fonts)` hears them at once and at each change.
    function start({ onChange }) {
        fonts = FONTS.keptOf(deckit.state.read(KEPT, {}));
        onChange(fonts);
        PROTOCOL.current.handle((_payload, sender) => {
            holds(sender);
            return fonts;
        });
        PROTOCOL.set.handle((change, sender) => {
            holds(sender);
            const problem = FONTS.problemOf(change);
            if (problem) throw new Error(`fonts.set() ${problem}`);
            const next = FONTS.merged(fonts, change);
            if (JSON.stringify(next) === JSON.stringify(fonts)) return fonts;
            fonts = next;
            deckit.state.write(KEPT, fonts);
            onChange(fonts);
            return fonts;
        });
    }

    // MARK: - Private
    // Held to the permission: main does not take a page's word for it.
    function holds(page) {
        const modId = deckit.mods.modOf(page);
        const permissions = deckit.mods.runOf(modId)?.mod.permissions || [];
        if (permissions.some(({ id }) => id === FONTS_PERMISSION.FONTS)) return;
        const refused = new Error(`${modId || 'the page'} does not have the ${FONTS_PERMISSION.FONTS} permission`);
        throw Object.assign(refused, { kind: 'REFUSED' });
    }

    return { start };
}
