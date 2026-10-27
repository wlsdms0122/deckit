import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as WINDOW_PERMISSION from './model/permission.js';

// `deckit` is what connect answered; `showWindow(control)` and `hideWindow(control)` are the host app's, which puts a
// mod's window on screen and away.
export function createWindow({ deckit, showWindow, hideWindow }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    // mod id -> { control, page, look, stage, shown }: `page` the mod's page while a run of it that has a window
    // runs, `look` its window as that run said, `stage` where the page is laid, made as the window is first placed
    const windows = new Map();

    // MARK: - Initializer
    // MARK: - Public
    // The windows of the mods that said they have one, as the mods run. A mod's page is laid in its window, which the
    // host app makes and keeps under the same control from run to run.
    function start() {
        PROTOCOL.open.on((_payload, sender) => open(heldBy(sender)));
        PROTOCOL.close.on((_payload, sender) => close(heldBy(sender)));
        for (const name of deckit.mods.notifications) deckit.mods.observe(name, reconcile);
        reconcile();
    }

    // Whether a deckit page is one in a window on screen, where it is in front.
    function isActive(page) {
        return [...windows.values()].some((held) => held.shown && held.page === page);
    }

    // MARK: - Private
    // A window open while its mod's page goes is put away: the page in it is gone.
    function reconcile() {
        const running = new Map(
            deckit.mods
                .runs()
                .filter(({ run }) => run.state === 'running' && run.summary?.window)
                .map(({ run, page }) => [run.mod.id, { run, page }])
        );
        for (const held of windows.values()) {
            if (running.get(held.control.mod)?.page === held.page) continue;
            putAway(held);
            held.page = null;
            lay(held);
        }
        for (const [id, { run, page }] of running) {
            const held = windows.get(id) || make(id);
            held.page = page;
            held.look = lookOf(run);
            lay(held);
        }
    }

    // A window is an overlay only for a mod that holds the permission, whatever its page says.
    function lookOf(run) {
        const { width, height, overlay } = run.summary.window;
        const may = run.mod.permissions.some(({ id }) => id === WINDOW_PERMISSION.OVERLAY_WINDOWS);
        return { name: run.mod.name, width, height, overlay: !!overlay && may };
    }

    function make(id) {
        const held = { control: null, page: null, look: null, stage: null, shown: false };
        // What the host app drives of the window: where it is laid and how it is told the keyboard comes and goes.
        held.control = Object.freeze({
            mod: id,
            get name() {
                return held.look.name;
            },
            get width() {
                return held.look.width;
            },
            get height() {
                return held.look.height;
            },
            get overlay() {
                return held.look.overlay;
            },
            // Into one of the host app's windows, as deckit places a view (`front`, `bounds`, `onClose`): the mod's
            // page fills it. A window the host app closes puts the mod's away.
            place: (window, { onClose = null, ...options } = {}) =>
                stageOf(held).place(window, {
                    ...options,
                    onClose: (view) => {
                        putAway(held, { told: false });
                        onClose?.(view);
                    },
                }),
            contains: (page) => !!page && page === held.page,
            focus: () => held.page && deckit.pages.focus(held.page),
            didResignKey: () => held.shown && PROTOCOL.resignKey.send(held.page, {}),
        });
        windows.set(id, held);
        return held;
    }

    function heldBy(sender) {
        const held = windows.get(deckit.mods.modOf(sender));
        return held?.page === sender ? held : null;
    }

    function open(held) {
        if (!held || held.shown || !deckit.pages.isAlive(held.page)) return;
        held.shown = true;
        lay(held);
        showWindow(held.control);
        deckit.pages.focus(held.page);
        PROTOCOL.shown.send(held.page, { on: true });
    }

    function close(held) {
        if (held) putAway(held);
    }

    // `told`: the host app is told to put its window away, unless it is the one that did.
    function putAway(held, { told = true } = {}) {
        if (!held.shown) return;
        held.shown = false;
        lay(held);
        if (told) hideWindow(held.control);
        if (deckit.pages.isAlive(held.page)) PROTOCOL.shown.send(held.page, { on: false });
    }

    function stageOf(held) {
        if (!held.stage) {
            held.stage = deckit.pages.stage();
            held.stage.whenResized(() => lay(held));
            lay(held);
        }
        return held.stage;
    }

    // Put away, the stage is hidden with the page: a stage shown takes its clicks where it draws nothing too.
    function lay(held) {
        const { stage, page } = held;
        if (!stage) return;
        stage.show(held.shown);
        if (!page || !deckit.pages.isAlive(page)) return stage.lay([]);
        stage.lay([held.shown ? { page, rect: { x: 0, y: 0, ...stage.size() } } : { page, hidden: true }]);
    }

    return { start, isActive };
}
