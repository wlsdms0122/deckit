import * as STYLE_PERMISSION from './model/permission.js';

export function createStyle({ PROTOCOL }) {
    // MARK: - Property
    const EVERY_PAGE = '*';
    const pages = new Map(); // a page that wears styles -> the mod it runs, or null for a page the shell made
    let deckit = null;

    // MARK: - Initializer
    // MARK: - Public
    // A mod with `deckit.styles` styles other pages while it runs: a mod's by its id, or every page the shell draws
    // by "*". Each page wears what applies to it in the mods' order, the later over the earlier.
    function start({ deckit: given }) {
        deckit = given;
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
            .map(stylesOf)
            .filter(Boolean)
            .flatMap((given) => [given[EVERY_PAGE], modId && given[modId]].filter((css) => typeof css === 'string'));
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
