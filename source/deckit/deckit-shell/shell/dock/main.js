import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as LIST_ORDER from './model/list-order.js';
import * as DOCK from './model/dock.js';
import * as FIELD from '../mods/field.js';
import * as MODS from '../mods/index.js';

// `deckit` is what connect answered, `host` the app's answers, `DESKTOP` the desktop, `WINDOWS` the mods' windows, and
// `dock` the ids of the mods the host app keeps in the Dock at the first start, or null.
export function createDock({ deckit, DESKTOP, WINDOWS, host, dock }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const PINNED = 'panel-pinned';
    const ORDER = 'panel-order';
    let pinned = new Set(); // the mods the person keeps in the Dock
    let order = []; // the ids of the mods, as the person arranged the Dock

    // MARK: - Initializer
    // MARK: - Public
    // The Dock: the app mods the person keeps there, running or not, then those running now. A mod with deckit.mods
    // reads and changes it, and opens a mod as the person does from it.
    function start() {
        // At the first start the Dock's mods take their places in the order they are kept there.
        const kept = deckit.state.read(PINNED, null);
        const arranged = deckit.state.read(ORDER, null);
        pinned = new Set(kept ?? firstDock());
        order = arranged ?? (kept ? [] : [...pinned]);
        if (!kept) keep(PINNED, [...pinned]);
        if (!kept && !arranged) keep(ORDER, order);
        PROTOCOL.icon.handle(({ mod }) => FIELD.iconOf(deckit.mods.fieldsOf(mod)));
        PROTOCOL.list.handle((_payload, sender) => {
            deckit.mods.managerFrom(sender);
            return listed();
        });
        PROTOCOL.pinned.handle((_payload, sender) => {
            deckit.mods.managerFrom(sender);
            return [...pinned];
        });
        PROTOCOL.setPinned.handle(({ id, pinned: on }, sender) => {
            deckit.mods.managerFrom(sender);
            setPinned(id, on);
        });
        PROTOCOL.open.handle(({ id }, sender) => {
            deckit.mods.managerFrom(sender);
            if (!isApp(id)) throw new Error(`${id} is no app`);
            open(id);
        });
    }

    // What the Dock shows, `[{ id, name, icon, pinned, running }]`: the app mods kept there, as the person arranged
    // them, then those running now.
    function items() {
        const apps = inOrder().filter(({ id }) => isApp(id));
        const names = new Map(apps.map(({ id, name }) => [id, name]));
        return DOCK.items([...names.keys()], { pinned, running: runningIds() }).map((item) => ({
            ...item,
            name: names.get(item.id),
            icon: FIELD.iconOf(deckit.mods.fieldsOf(item.id)),
        }));
    }

    // A mod opened as from its Dock item: one that does not run launches; one that runs has its windows come in
    // front, or, with none open, its instance's reopen(). The host window comes up.
    function open(id) {
        const run = deckit.mods.runOf(id);
        if (!run || (run.state === 'notRunning' && !run.relaunches))
            deckit.mods.launch(id).catch((error) => deckit.log.error(`${id} did not launch`, error));
        else if (!DESKTOP.activate(id) && run.state === 'running') {
            const page = deckit.mods.runs().find((each) => each.run.mod.id === id)?.page;
            if (page) WINDOWS.reopen(page);
        }
        host.show();
    }

    // MARK: - Private
    // What the Dock keeps between runs, as the person left it. The Dock goes on with it whether deckit keeps it or
    // refuses the write, as it does state it did not read; deckit logs why it refused.
    function keep(key, value) {
        deckit.state.write(key, value).catch(() => {});
    }

    function setPinned(id, on) {
        if (on === pinned.has(id)) return;
        if (on) pinned.add(id);
        else pinned.delete(id);
        keep(PINNED, [...pinned]);
    }

    // What the Dock keeps at the first start, in order: the mods the host app names, or else the app mods it ships, in
    // the mods' order.
    function firstDock() {
        if (dock) return dock;
        const shipped = new Set(deckit.mods.shipped());
        return MODS.loaded(deckit.mods)
            .map(({ id }) => id)
            .filter((id) => shipped.has(id) && isApp(id));
    }

    // A mod that loads and whose activation policy is regular.
    function isApp(id) {
        return (
            MODS.loaded(deckit.mods).some((mod) => mod.id === id) &&
            FIELD.activationPolicyOf(deckit.mods.fieldsOf(id)) === FIELD.REGULAR
        );
    }

    // The mods in the Dock's order: those the person placed, as they placed them, then the rest in the mods' order.
    function inOrder() {
        const mods = new Map(MODS.loaded(deckit.mods).map((mod) => [mod.id, mod]));
        return LIST_ORDER.sorted([...mods.keys()], order).map((id) => mods.get(id));
    }

    // Every app mod, in the Dock's order, marked as the Dock marks them.
    function listed() {
        const running = runningIds();
        return inOrder()
            .filter(({ id }) => isApp(id))
            .map(({ id, name }) => {
                const fields = deckit.mods.fieldsOf(id);
                return {
                    id,
                    name,
                    icon: FIELD.iconOf(fields),
                    keywords: FIELD.keywordsOf(fields),
                    pinned: pinned.has(id),
                    running: running.has(id),
                };
            });
    }

    // The ids of the mods whose run launches, runs or terminates, or that launch again.
    function runningIds() {
        return new Set(
            deckit.mods
                .runs()
                .filter(({ run }) => run.state !== 'notRunning' || run.relaunches)
                .map(({ run }) => run.mod.id)
        );
    }

    return { start, items, open };
}
