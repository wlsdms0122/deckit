import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as STYLE_PERMISSION from './model/permission.js';

// `deckit` is what connect answered.
export function createStyle({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const EVERY_PAGE = '*';
    const pages = new Map(); // a page that wears styles -> the mod it runs, or null for a page the shell made
    const declared = new Map(); // a mod's id -> { '<mod id>' | '*': css }, of the files its contributes declares

    // MARK: - Initializer
    // MARK: - Public
    // A mod with `deckit.styles` styles other pages: by id that mod's page, its own among them, and by "*" every page,
    // the shell's and every mod's. What its contributes declares under `styles`, a CSS file inside its folder for each,
    // is worn from the time it is installed, running or not, and what its run registers while it runs. Each page wears
    // what applies to it in the mods' order, the later over the earlier, a mod's declared styles before its run's, so a
    // mod's styles go over those of the mods it requires.
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
        deckit.mods.observe('didJoin', (run) => stylesOf(run) && tell());
        deckit.mods.observe('didTerminate', (run) => stylesOf(run) && tell());
        deckit.mods.onChange(readDeclared);
        readDeclared();
    }

    // MARK: - Private
    // What the page of `modId`, or one the shell made for null, wears.
    function stylesFor(modId) {
        return deckit.mods
            .list()
            .flatMap(({ id }) => {
                const run = deckit.mods.runOf(id);
                const given = [declared.get(id) || {}, (run?.state === 'running' && stylesOf(run)) || {}];
                return given.flatMap((styles) => [styles[EVERY_PAGE], modId && styles[modId]]);
            })
            .filter((css) => typeof css === 'string');
    }

    // The styles each mod with the permission declares, read again as the mods change: a file that is not there is
    // left out.
    async function readDeclared() {
        const next = new Map();
        for (const mod of deckit.mods.list()) {
            const files = deckit.mods.contributesOf(mod.id)?.styles;
            if (!mayStyle(mod) || !files || typeof files !== 'object') continue;
            const styles = {};
            for (const [target, file] of Object.entries(files)) {
                const css = typeof file === 'string' ? await deckit.mods.readFile(mod.id, file) : null;
                if (css !== null) styles[target] = css;
            }
            next.set(mod.id, styles);
        }
        declared.clear();
        for (const [id, styles] of next) declared.set(id, styles);
        tell();
    }

    // What a run styles, held to the permission: main does not take a page's word for it.
    function stylesOf(run) {
        const given = run.contributions?.styles;
        if (!given || !Object.keys(given).length) return null;
        return mayStyle(run.mod) ? given : null;
    }

    function mayStyle(mod) {
        return mod.permissions.some(({ id }) => id === STYLE_PERMISSION.STYLES);
    }

    function tell() {
        for (const [page, modId] of pages) PROTOCOL.changed.send(page, { styles: stylesFor(modId) });
    }

    return { start };
}
