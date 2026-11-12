import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/dock/protocol.js';
import * as LIST_ORDER from './model/list-order.js';
import * as DOCK from './model/dock.js';
import * as FIELD from '../../../deckit-sdk/shell/mods/field.js';
import * as MODS from '../mods/index.js';

// `deckit` is what connect answered, `state` the shell's own state, `host` the app's answers, `DESKTOP` the desktop,
// `WINDOWS` the mods' windows, `ICONS` the mods' icons, and `dock` the ids of the mods the host app keeps in the Dock at
// the first start, or null.
export function createDock({ deckit, state: STATE, DESKTOP, WINDOWS, ICONS, host, dock }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const PINNED = 'dock-pinned';
    let pinned = []; // the ids of the mods the person keeps in the Dock, in its order
    let launched = []; // the ids of the mods running, in the order they launched

    // MARK: - Initializer
    // MARK: - Public
    // The Dock: the app mods the person keeps there, running or not, then those running now. The desktop's page draws
    // it, and what the person does there is done by the seat whose screen it is, a click its input reaching the mod
    // clicked. A mod with deckit.mods reads it, keeps an app there or takes one out, and opens an app as the person
    // does from it, as the local seat, asking that mod.
    function start() {
        // At the first start the Dock's mods take their places in the order they are kept there.
        const kept = STATE.read(PINNED, null);
        pinned = kept ?? firstDock();
        if (!kept) keep(PINNED, pinned);
        PROTOCOL.list.handle(() => ICONS.ready().then(listed));
        PROTOCOL.icon.handle(({ id }) => ICONS.ready().then(() => ICONS.of(id)));
        PROTOCOL.pinned.handle(() => keptApps());
        PROTOCOL.setPinned.handle(({ id, pinned: on }) => {
            refuseNoApp(id);
            setPinned(id, on);
        });
        PROTOCOL.open.handle(({ id }, sender) => {
            const from = deckit.mods.modOf(sender);
            refuseNoApp(id);
            DESKTOP.activation.request(from, id);
            return open(id, DESKTOP.localSeat);
        });
        const bySeat = (handler) => (payload, sender) => {
            const seat = DESKTOP.seatAt(sender);
            if (seat) handler(payload, seat);
        };
        PROTOCOL.click.on(bySeat(({ id }, seat) => hand.click(id, seat)));
        PROTOCOL.quit.on(bySeat(({ id }) => hand.quit(id)));
        PROTOCOL.keep.on(bySeat(({ id, pinned: on }) => hand.keep(id, on)));
        PROTOCOL.reorder.on(bySeat(({ ids }) => hand.reorder(ids)));
        ICONS.onChange(() => DESKTOP.update());
        DESKTOP.update();
    }

    // What the person does to the Dock, as the desktop's page tells it or the host app hands it, for `seat`: a click
    // on an item, its input reaching the mod; Quit from its menu; Keep in Dock or Remove from Dock; and the items kept
    // there dragged into the order `ids` names. A click and Quit answer a promise, fulfilled once what they asked of
    // deckit is done, whether it was done or refused.
    const hand = Object.freeze({
        click: (id, seat) => {
            DESKTOP.activation.input(seat, id);
            return open(id, seat).catch((error) => deckit.log.error(`${id} did not launch`, error));
        },
        quit: (id) => quit(id),
        keep: (id, on) => setPinned(id, on),
        reorder: (ids) => arrange(ids),
    });

    // What the Dock shows, `[{ id, name, icon, pinned, running }]`: the app mods kept there, as the person arranged
    // them, then those running now, in the order they launched.
    function items() {
        const apps = inOrder().filter(({ id }) => isApp(id));
        const names = new Map(apps.map(({ id, name }) => [id, name]));
        return DOCK.items([...names.keys()], { pinned: new Set(pinned), running: new Set(launchOrder()) }).map(
            (item) => ({
                ...item,
                name: names.get(item.id),
                icon: ICONS.of(item.id),
            })
        );
    }

    // A mod opened from its Dock item by `seat`: the host window comes up where the mod may activate for the seat; then
    // one that does not run launches, and one that runs has its windows brought forward for that seat, or, with none
    // open, its instance's reopen(). Answers a promise, fulfilled once the mod launched it launches, and rejected as
    // the launch is refused.
    async function open(id, seat) {
        if (DESKTOP.activation.mayActivate(seat, id)) host.show();
        const run = deckit.mods.runOf(id);
        if (!run || (run.state === 'notRunning' && !run.relaunches)) return deckit.mods.launch(id);
        if (!WINDOWS.forward(seat, id) && run.state === 'running') {
            const page = deckit.mods.runs().find((each) => each.run.mod.id === id)?.page;
            if (page) WINDOWS.reopen(page);
        }
    }

    // MARK: - Private
    // What the Dock keeps between runs, as the person left it. The Dock goes on with it whether deckit keeps it or
    // refuses the write, as it does state it did not read; deckit logs why it refused.
    function keep(key, value) {
        STATE.write(key, value).catch(() => {});
    }

    // A mod kept comes after those kept before it, and one taken out leaves the order.
    function setPinned(id, on) {
        if (on === pinned.includes(id)) return;
        pinned = on ? [...pinned, id] : pinned.filter((one) => one !== id);
        keep(PINNED, pinned);
        DESKTOP.update();
    }

    // The kept mods `ids` names take the places they held among themselves, in the order given; the rest stay put.
    function arrange(ids) {
        pinned = LIST_ORDER.arranged(pinned, ids);
        keep(PINNED, pinned);
        DESKTOP.update();
    }

    // Whether the Dock keeps the mod `id`.
    function keeps(id) {
        return pinned.includes(id);
    }

    // The mod `id` taken out of what the Dock keeps, once deckit has kept that. Answers a promise that rejects where
    // deckit refused a write.
    async function forget(id) {
        if (!keeps(id)) return;
        const next = pinned.filter((one) => one !== id);
        await STATE.write(PINNED, next);
        pinned = next;
        DESKTOP.update();
    }

    // The person quits a mod from its Dock item's menu.
    function quit(id) {
        return deckit.mods.quit(id).catch((error) => deckit.log.error(`${id} did not quit`, error));
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

    // A mod asked for by a mod's page is an app: refused at call, INVALID_ARGUMENT, for any other.
    function refuseNoApp(id) {
        if (!isApp(id)) throw Object.assign(new Error(`${id} is no app`), { stage: 'call', kind: 'INVALID_ARGUMENT' });
    }

    // A mod that loads and whose activation policy is regular.
    function isApp(id) {
        return (
            MODS.loaded(deckit.mods).some((mod) => mod.id === id) &&
            FIELD.activationPolicyOf(deckit.mods.fieldsOf(id)) === FIELD.REGULAR
        );
    }

    // The mods in the Dock's order: those kept there, in its order, then the rest in the mods' order.
    function inOrder() {
        const mods = new Map(MODS.loaded(deckit.mods).map((mod) => [mod.id, mod]));
        return LIST_ORDER.sorted([...mods.keys()], pinned).map((id) => mods.get(id));
    }

    // The ids of the app mods kept in the Dock, in its order.
    function keptApps() {
        return pinned.filter((id) => isApp(id));
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
                    icon: ICONS.of(id),
                    keywords: FIELD.keywordsOf(fields),
                    pinned: pinned.includes(id),
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

    return { start, items, open, hand, keeps, forget };
}
