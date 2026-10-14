import * as PROTOCOL from './protocol.js';

export function createRegion() {
    // MARK: - Property
    // `${webContents id}:${number}` -> { parent, rect, child }: a place in a mod's page that shows a child's view
    const regions = new Map();
    // mod id -> { parent }: the view its run that last started has, kept while the mod launches again
    const known = new Map();
    const sentChildren = new Map(); // parent mod id -> its children as its page was last told them, written
    const listeners = new Set();
    let deckit = null;

    // MARK: - Initializer
    // MARK: - Public
    // The places mods give in their views, and the children shown in them. A mod whose view names a parent is
    // that one's child from when its run starts, through launching again, until a run starts that names none.
    // `deckit` is what connect answered.
    function start({ deckit: given }) {
        deckit = given;
        deckit.mods.observe('didLaunch', ({ mod, summary }) => {
            const before = parentOf(mod.id);
            if (summary.view) known.set(mod.id, { parent: summary.parent || null });
            else known.delete(mod.id);
            if (parentOf(mod.id) !== before) leave(mod.id);
        });
        for (const name of deckit.mods.notifications) deckit.mods.observe(name, changed);
        deckit.mods.onChange(changed);
        // What a page is answered is what it knows: a parent's new page hears every change from there.
        PROTOCOL.children.handle((_payload, sender) => {
            const parent = deckit.mods.modOf(sender);
            const children = childrenOf(parent);
            if (parent) sentChildren.set(parent, JSON.stringify(children));
            return children;
        });
        PROTOCOL.rect.on(({ region, ...rect }, sender) => deckit.mods.modOf(sender) && setRect(sender, region, rect));
        PROTOCOL.place.handle(({ region, id }, sender) => place(sender, region, id ?? null));
        PROTOCOL.end.on(({ region }, sender) => end(sender.id + ':' + region));
    }

    // The mod whose regions the mod's view is shown in, or null.
    function parentOf(id) {
        return known.get(id)?.parent || null;
    }

    // child id -> its rect: the children `parent`'s regions show, of those `shown(id)` lets on screen, laid out.
    function laidOut(parent, shown) {
        const laid = new Map();
        for (const { parent: owner, rect, child } of regions.values()) {
            if (owner !== parent || !child || parentOf(child) !== parent || !shown(child)) continue;
            if (rect.width > 0 && rect.height > 0) laid.set(child, rect);
        }
        return laid;
    }

    // The rect of the region that shows the child, or null.
    function rectOf(child) {
        return [...regions.values()].find((region) => region.child === child)?.rect || null;
    }

    // Hears each change to where children are: answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    // A region is its page's: it ends with the page, run by run, or when its element leaves the page.
    function setRect(page, number, rect) {
        const key = page.id + ':' + number;
        if (!regions.has(key)) {
            regions.set(key, { parent: deckit.mods.modOf(page), rect, child: null });
            deckit.pages.whenEnds(page, () => end(key));
        }
        regions.get(key).rect = rect;
        tell();
    }

    // A child is in one region at a time: shown in another, it leaves the one it was in.
    function place(page, number, id) {
        const parent = deckit.mods.modOf(page);
        if (!parent) throw new Error('only a mod has regions');
        if (id !== null && parentOf(id) !== parent) throw new Error(`${id} is not a child of ${parent}`);
        const key = page.id + ':' + number;
        if (!regions.has(key)) setRect(page, number, { x: 0, y: 0, width: 0, height: 0 });
        if (id !== null) leave(id);
        regions.get(key).child = id;
        tell();
    }

    function end(key) {
        if (regions.delete(key)) tell();
    }

    // Out of every region it is in.
    function leave(id) {
        for (const region of regions.values()) if (region.child === id) region.child = null;
    }

    // A mod gone from the catalog is no one's child; each parent hears its children as they change.
    function changed() {
        const installed = new Set(deckit.mods.list().map(({ id }) => id));
        for (const id of [...known.keys()]) if (!installed.has(id)) known.delete(id);
        const parents = new Set([...sentChildren.keys(), ...[...known.values()].map(({ parent }) => parent)]);
        for (const parent of parents) {
            if (!parent) continue;
            const children = childrenOf(parent);
            const written = JSON.stringify(children);
            if ((sentChildren.get(parent) ?? '[]') === written) continue;
            sentChildren.set(parent, written);
            const page = deckit.mods.runs().find(({ run }) => run.mod.id === parent)?.view?.webContents;
            if (page) PROTOCOL.childrenChanged.send(page, { children });
        }
        tell();
    }

    // Its children that run, or launch again, in the person's order.
    function childrenOf(parent) {
        if (!parent) return [];
        return deckit.mods
            .list()
            .filter(({ id }) => parentOf(id) === parent && runs(id))
            .map(({ id, name }) => ({ id, name, icon: deckit.mods.listingOf(id)?.icon || '' }));
    }

    function runs(id) {
        const run = deckit.mods.runOf(id);
        return !!run && (run.state !== 'notRunning' || run.relaunches);
    }

    function tell() {
        for (const listener of listeners) listener();
    }

    return { start, parentOf, laidOut, rectOf, onChange };
}
