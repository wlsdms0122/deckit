import * as CHANNEL from '../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as STYLE_PERMISSION from './model/permission.js';
import * as MOD from '../deck/catalog/model/mod.js';

// `deckit` is what connect answered.
export function createStyle({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const EVERY_PAGE = '*';
    const pages = new Map(); // a page that wears styles -> the mod it runs, or null for a page the shell made

    // MARK: - Initializer
    // MARK: - Public
    // A mod with `deckit.styles` styles other pages while it runs: by id its own and those of the mods it links, those
    // it requires or uses optionally, and by "*" every page, the shell's and every mod's. Each page wears what applies
    // to it in the load order, the later over the earlier, so a mod's styles go over those of the mods it links.
    function start() {
        PROTOCOL.current.handle((_payload, sender) => {
            const modId = deckit.mods.modOf(sender);
            if (!modId && !deckit.pages.nameOf(sender))
                throw Object.assign(new Error('only a deckit page wears styles'), { kind: 'REFUSED' });
            if (!pages.has(sender)) deckit.pages.whenEnds(sender, () => pages.delete(sender));
            pages.set(sender, modId);
            return stylesFor(modId);
        });
        deckit.mods.observe('didLaunch', (run) => stylesOf(run) && tell());
        deckit.mods.observe('didTerminate', (run) => stylesOf(run) && tell());
        deckit.mods.onChange(tell);
    }

    // MARK: - Private
    // What the page of `modId`, or one the shell made for null, wears.
    function stylesFor(modId) {
        return deckit.mods
            .list()
            .map(({ id }) => deckit.mods.runOf(id))
            .filter((run) => run?.state === 'running')
            .flatMap((run) => {
                const given = stylesOf(run) || {};
                const own = run.mod.id === modId || MOD.links(run.mod, modId);
                return [given[EVERY_PAGE], modId && own && given[modId]];
            })
            .filter((css) => typeof css === 'string');
    }

    // What a run styles, held to the permission: main does not take a page's word for it.
    function stylesOf(run) {
        const given = run.contributions?.styles;
        if (!given || !Object.keys(given).length) return null;
        return run.mod.permissions.some(({ id }) => id === STYLE_PERMISSION.STYLES) ? given : null;
    }

    function tell() {
        for (const [page, modId] of pages) PROTOCOL.changed.send(page, { styles: stylesFor(modId) });
    }

    return { start };
}
