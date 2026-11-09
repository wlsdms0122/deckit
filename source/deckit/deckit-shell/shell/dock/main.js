import * as CHANNEL from '../../deckit/channel/index.js';
import * as MOD_PERMISSION from '../../deckit/permission/index.js';
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
    let launched = []; // the ids of the mods running, in the order they launched

    // MARK: - Initializer
    // MARK: - Public
    // The Dock: the app mods the person keeps there, running or not, then those running now. The desktop's page draws
    // it, and what the person does there is done by the seat whose screen it is, a click its input reaching the mod
    // clicked. A mod with deckit.mods reads and changes it, and opens a mod as the person does from it, as the local
    // seat, asking that mod.
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
            deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            return listed();
        });
        PROTOCOL.pinned.handle((_payload, sender) => {
            deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            return [...pinned];
        });
        PROTOCOL.setPinned.handle(({ id, pinned: on }, sender) => {
            deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            setPinned(id, on);
        });
        PROTOCOL.open.handle(({ id }, sender) => {
            const from = deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            if (!isApp(id)) throw new Error(`${id} is no app`);
            DESKTOP.activation.request(from, id);
            open(id, DESKTOP.localSeat);
        });
        const bySeat = (handler) => (payload, sender) => {
            const seat = DESKTOP.seatAt(sender);
            if (seat) handler(payload, seat);
        };
        PROTOCOL.click.on(
            bySeat(({ id }, seat) => {
                DESKTOP.activation.input(seat, id);
                open(id, seat);
            })
        );
        PROTOCOL.quit.on(bySeat(({ id }) => quit(id)));
        PROTOCOL.keep.on(bySeat(({ id, pinned: on }) => setPinned(id, on)));
        PROTOCOL.reorder.on(bySeat(({ ids }) => arrange(ids)));
        DESKTOP.update();
    }

    // What the Dock shows, `[{ id, name, icon, pinned, running }]`: the app mods kept there, as the person arranged
    // them, then those running now, in the order they launched.
    function items() {
        const apps = inOrder().filter(({ id }) => isApp(id));
        const names = new Map(apps.map(({ id, name }) => [id, name]));
        return DOCK.items([...names.keys()], { pinned, running: new Set(launchOrder()) }).map((item) => ({
            ...item,
            name: names.get(item.id),
            icon: FIELD.iconOf(deckit.mods.fieldsOf(item.id)),
        }));
    }

    // A mod opened from its Dock item by `seat`: one that does not run launches; one that runs has its windows brought
    // forward for that seat, or, with none open, its instance's reopen(). The host window comes up where the mod may
    // activate for the seat.
    function open(id, seat) {
        const run = deckit.mods.runOf(id);
        if (!run || (run.state === 'notRunning' && !run.relaunches))
            deckit.mods.launch(id).catch((error) => deckit.log.error(`${id} did not launch`, error));
        else if (!DESKTOP.activate(seat, id) && run.state === 'running') {
            const page = deckit.mods.runs().find((each) => each.run.mod.id === id)?.page;
            if (page) WINDOWS.reopen(page);
        }
        if (DESKTOP.activation.mayActivate(seat, id)) host.show();
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
        DESKTOP.update();
    }

    // The ids named take the places they held among themselves, in the order given; the rest stay put.
    function arrange(ids) {
        order = LIST_ORDER.arranged(
            inOrder().map(({ id }) => id),
            ids
        );
        keep(ORDER, order);
        DESKTOP.update();
    }

    // The person quits a mod from its Dock item's menu.
    function quit(id) {
        deckit.mods.quit(id).catch((error) => deckit.log.error(`${id} did not quit`, error));
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

    // The ids of the mods running, in the order they launched: those that ran before keep their places, and those
    // that run since come after them.
    function launchOrder() {
        const running = runningIds();
        launched = launched.filter((id) => running.has(id));
        launched.push(...[...running].filter((id) => !launched.includes(id)));
        return launched;
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
