import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/region/protocol.js';
import * as FIELD from '../../../deckit-sdk/shell/mods/field.js';
import * as MODS from '../mods/index.js';

// `deckit` is what connect answered.
export function createRegion({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    // a mod's page -> number -> { parent, interface, window, rect, child }: a place in one of the page's windows, by the
    // window's id, that shows a child's view
    const regions = new Map();
    const shown = new Set(); // the children's pages last told they are on screen
    const sentChildren = new Map(); // parent mod id -> its children as its page was last told them, written
    const listeners = new Set();

    // MARK: - Initializer
    // MARK: - Public
    // The places mods give in their windows, and the children shown in them. A mod whose manifest fields give a view
    // with an interface as its parent is a child, whether it runs or not; it is the child of the owner of that
    // interface, and is shown in a region that mod gives for it. As another owns it, or the view names another
    // interface, the child leaves the region it was in, and the owner now hears it among its children.
    function start() {
        for (const name of deckit.mods.notifications) deckit.mods.observe(name, changed);
        deckit.mods.onChange(changed);
        // What a page is answered is what it knows: a parent's new page hears every change from there.
        PROTOCOL.children.handle((_payload, sender) => {
            const parent = deckit.mods.modOf(sender);
            const children = childrenOf(parent);
            if (parent) sentChildren.set(parent, JSON.stringify(children));
            return children;
        });
        PROTOCOL.rect.on(({ region, interface: named, window, ...rect }, sender) => {
            const parent = deckit.mods.modOf(sender);
            if (parent && providesOf(parent).has(named)) setRect(sender, region, named, window ?? null, rect);
        });
        PROTOCOL.place.handle(({ region, interface: named, id }, sender) => place(sender, region, named, id ?? null));
        PROTOCOL.end.on(({ region }, sender) => end(sender, region));
    }

    // The interface the mod's view names as its parent, or null: it is a child whether or not a mod owns it.
    function interfaceOf(id) {
        const mod = MODS.loaded(deckit.mods).find((one) => one.id === id);
        return (mod && FIELD.parentOf(deckit.mods.fieldsOf(id), mod)) || null;
    }

    // The mod whose regions the mod's view is shown in, the owner of the interface its view names, which the mod uses,
    // at the major it uses, or null. The owner of the interface it names is no one's child: `ownerOf` answers null for
    // it.
    function parentOf(id) {
        const named = interfaceOf(id);
        return (named && deckit.mods.ownerOf(named, id)) || null;
    }

    // child id -> { window, rect }: the children `parent`'s regions show, of those `shows(id)` lets on screen, each in
    // the window of its region, `rect` in that window.
    function laidOut(parent, shows) {
        const laid = new Map();
        for (const region of every()) {
            const { window, rect, child } = region;
            if (region.parent !== parent || !child || !holds(region, child) || !shows(child)) continue;
            if (window !== null && rect.width > 0 && rect.height > 0) laid.set(child, { window, rect });
        }
        return laid;
    }

    // The children's pages on screen are `pages`: each told as it comes on screen and as it leaves.
    function show(pages) {
        const now = new Set(pages);
        for (const page of shown) if (!now.has(page)) PROTOCOL.visible.send(page, { open: false });
        for (const page of now) if (!shown.has(page)) PROTOCOL.visible.send(page, { open: true });
        shown.clear();
        for (const page of now) shown.add(page);
    }

    // Hears each change to where children are: answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    // A region is its page's, for one interface its mod provides: it ends with the page, run by run, or when its
    // element leaves the page.
    function setRect(page, number, named, window, rect) {
        if (!regions.has(page)) {
            regions.set(page, new Map());
            deckit.pages.whenEnds(page, () => regions.delete(page) && tell());
        }
        const inPage = regions.get(page);
        if (!inPage.has(number))
            inPage.set(number, { parent: deckit.mods.modOf(page), interface: named, window, rect, child: null });
        const region = inPage.get(number);
        if (region.interface !== named) return;
        region.window = window;
        region.rect = rect;
        tell();
    }

    // A child is in one region at a time: shown in another, it leaves the one it was in. A region shows only the
    // children of its own interface. A child that does not run launches as the person's screen shows it.
    function place(page, number, named, id) {
        const parent = deckit.mods.modOf(page);
        if (!providesOf(parent).has(named)) throw new Error(`${parent} does not provide ${named}`);
        if (id !== null && (interfaceOf(id) !== named || parentOf(id) !== parent))
            throw new Error(`${id} is not a child of ${named} here`);
        if (!regions.get(page)?.has(number)) setRect(page, number, named, null, { x: 0, y: 0, width: 0, height: 0 });
        const region = regions.get(page).get(number);
        if (region.interface !== named) throw new Error(`the region is for ${region.interface}, not ${named}`);
        if (id !== null) leave(id);
        region.child = id;
        if (id !== null && !runs(id))
            deckit.mods.launch(id).catch((error) => deckit.log.error(`${id} did not launch`, error));
        tell();
    }

    function end(page, number) {
        if (regions.get(page)?.delete(number)) tell();
    }

    // Out of every region it is in.
    function leave(id) {
        for (const region of every()) if (region.child === id) region.child = null;
    }

    // Whether the region may show the child now: its parent is the owner of the region's interface.
    function holds(region, child) {
        return interfaceOf(child) === region.interface && parentOf(child) === region.parent;
    }

    function* every() {
        for (const inPage of regions.values()) yield* inPage.values();
    }

    // The interfaces a mod provides, by its manifest: main does not take a page's word for it.
    function providesOf(id) {
        const mod = MODS.loaded(deckit.mods).find((one) => one.id === id);
        return new Set(Object.keys(mod?.provides ?? {}));
    }

    // A child whose interface another mod owns now, or whose view names another, leaves the region it was in; each
    // parent hears its children as they change.
    function changed() {
        for (const region of every()) if (region.child && !holds(region, region.child)) region.child = null;
        const parents = new Set([...sentChildren.keys(), ...MODS.loaded(deckit.mods).map(({ id }) => parentOf(id))]);
        for (const parent of parents) {
            if (!parent) continue;
            const children = childrenOf(parent);
            const written = JSON.stringify(children);
            if ((sentChildren.get(parent) ?? '{}') === written) continue;
            sentChildren.set(parent, written);
            const page = deckit.mods.runs().find(({ run }) => run.mod.id === parent)?.page;
            if (page) PROTOCOL.childrenChanged.send(page, { children });
        }
        tell();
    }

    // Interface -> its children, running or not, in the mods' order, for each interface `parent` provides.
    function childrenOf(parent) {
        if (!parent) return {};
        const mods = MODS.loaded(deckit.mods);
        const children = {};
        for (const named of providesOf(parent))
            children[named] = mods
                .filter(({ id }) => interfaceOf(id) === named && parentOf(id) === parent)
                .map(({ id, name }) => ({ id, name, icon: FIELD.iconOf(deckit.mods.fieldsOf(id)) }));
        return children;
    }

    function runs(id) {
        const run = deckit.mods.runOf(id);
        return !!run && (run.state !== 'notRunning' || run.relaunches);
    }

    function tell() {
        for (const listener of listeners) listener();
    }

    return { start, interfaceOf, parentOf, laidOut, show, onChange };
}
