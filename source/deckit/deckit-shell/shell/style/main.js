import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as STYLE_PERMISSION from './model/permission.js';
import * as MODS from '../mods/index.js';

// `deckit` is what connect answered.
export function createStyle({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const EVERY_PAGE = '*';
    const FIELD = 'styles'; // the manifest field read here, named to deckit before its core starts
    const pages = new Map(); // a page that wears styles -> the mod it runs, or null for a page the shell made
    const declared = new Map(); // a mod's id -> { '<mod id>' | '*': css }, of the files its manifest's `styles` names

    // MARK: - Initializer
    deckit.fields.define(FIELD);

    // MARK: - Public
    // A mod with `deckit.styles` styles other pages: by id that mod's page, its own among them, and by "*" every page,
    // the shell's and every mod's. What its manifest field `styles` names, a CSS file inside its folder for each,
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
        deckit.mods.observe('didTerminate', (run) => stylesOf(run) && tell());
        deckit.mods.onChange(readDeclared);
        readDeclared();
    }

    // MARK: - Private
    // What the page of `modId`, or one the shell made for null, wears.
    function stylesFor(modId) {
        return MODS.loaded(deckit.mods)
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
        for (const mod of MODS.loaded(deckit.mods)) {
            const files = deckit.mods.fieldsOf(mod.id)?.[FIELD];
            const may = deckit.mods.grantedOf(mod.id)?.includes(STYLE_PERMISSION.STYLES);
            if (!may || !files || typeof files !== 'object') continue;
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
        return run.granted.includes(STYLE_PERMISSION.STYLES) ? given : null;
    }

    function tell() {
        for (const [page, modId] of pages) PROTOCOL.changed.send(page, { styles: stylesFor(modId) });
    }

    return { start };
}
