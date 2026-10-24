import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as KEYMAP_PERMISSION from './model/permission.js';
import * as KEY_REACH from './model/reach.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Keys, as the core resolves them: the core keeps the keymap and says how each binding stands, and a keystroke is
// resolved here against the copy it last told, where the keystroke lands. `pages` and `keys` are the environment's.
export function createKeymap({ LOG, IDENTITY, CATALOG, RUNNER, CORE, pages: PAGES, keys: KEYS }) {
    // MARK: - Property
    const RECORDING_MS = 20 * 1000;
    const runs = new Map(); // action -> run(page), of the keys registered through what connect answers
    const hotkeys = new Map(); // chord -> its off, or null where the system did not give it, as each is held in any app
    const typing = new WeakSet(); // pages with a field focused
    const local = new Map(); // page -> [{ keystroke, run }], taken there before anything else
    let keymap = { revision: 0, bindings: [] };
    let recording = null; // { page, drop, timer }
    let delegated = { isActive: () => false, monitor: () => false };

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.handleEffect('bindingsChanged', ({ revision, bindings }) => keep({ revision, bindings }));
        PROTOCOL.typing.on(({ on }, sender) => {
            if (on) typing.add(sender);
            else typing.delete(sender);
        });
        PROTOCOL.record.on(({ on }, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
            if (on) startRecording(sender);
            else if (recording?.page === sender) stopRecording(false);
        });
        PROTOCOL.chord.handle(({ action, app }, sender) => {
            const owner = app ? null : IDENTITY.modFrom(sender).id;
            return chordOf(action, (binding) => (app ? binding.app : binding.owner === owner));
        });
        PROTOCOL.bindings.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
            return keymap.bindings;
        });
        PROTOCOL.bind.handle(async ({ id, spec }, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
            keep(await CORE.request('keymap/bind', { id, spec }));
            return true;
        });
        PROTOCOL.reset.handle(async ({ id }, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
            keep(await CORE.request('keymap/reset', { id }));
            return true;
        });
    }

    // What the key map asks the shell of a deckit page a keystroke landed in: `isActive(page)`, whether it is the
    // page in front, where the mod's own keys and the shell's run; `monitor(page, keystroke)`, the shell's look at the
    // key pressed before any binding, `{ code, meta, control, alt, shift }`, taking it by answering true.
    function delegate({ isActive, monitor }) {
        delegated = { isActive, monitor };
    }

    // Keystrokes in `target`, a page, go through the key map. deckit listens on its own pages and the web pages they
    // show; an app hands its own where deckit's keys that reach the app should work too. `page` is the deckit page a
    // keystroke here belongs to, as web answers it, or null: the keys of the page in front run only in one. `keys` are
    // the target's own, taken there first: only a chord main catches wins over a meaning the app's menu gives it.
    function listen(target, { keys = [], page = null } = {}) {
        let destroyed = false;
        if (keys.length)
            CORE.request('keymap/keystrokes', { specs: keys.map(({ key }) => String(key)) }).then(
                (keystrokes) => {
                    if (destroyed) return;
                    const read = keys.map(({ run }, index) => ({ keystroke: keystrokes[index], run }));
                    local.set(
                        target,
                        read.filter(({ keystroke }) => keystroke)
                    );
                },
                (error) => LOG.error("a page's own keys were not read", error)
            );
        KEYS.capture(target, (keystroke) => handle(target, page, keystroke));
        // A replaced document or an ended process keeps the page, but what the page had focused is gone.
        const forget = () => typing.delete(target);
        PAGES.watch(target, {
            ended: forget,
            gone: forget,
            destroyed: () => {
                destroyed = true;
                local.delete(target);
                forget();
            },
        });
    }

    // A key registered through what connect answers, run by whoever registered it: the host app, or the shell it put
    // on deckit. By its `reach` it works in the page in front, anywhere a page is listened to, or in any app too, run
    // there with no page.
    function register({ action, key, label = '', reach = 'front', run }) {
        if (!KEY_REACH.REACHES.includes(reach)) throw new Error(`[deckit] the key ${action} has no reach ${reach}`);
        runs.set(action, run);
        CORE.request('keymap/register', { action, key: String(key), label: String(label), reach }).then(keep, (error) =>
            LOG.error(`the key ${action} was not registered`, error)
        );
    }

    // The chord a key registered through what connect answers is bound to now, by its action, as a person reads it.
    function chordOfApp(action) {
        return chordOf(action, (binding) => binding.app);
    }

    // MARK: - Private
    function chordOf(action, owns) {
        return (
            keymap.bindings.find((binding) => owns(binding) && binding.action === action && binding.active)?.chord || ''
        );
    }

    // The later of what the core told, whichever way each came.
    function keep(told) {
        if (told.revision <= keymap.revision) return;
        keymap = told;
        holdHotkeys();
        for (const mod of CATALOG.mods()) {
            const page = IDENTITY.pageOf(mod.id);
            if (page) PROTOCOL.changed.send(page, {});
        }
    }

    // Each chord a key that works in any app is bound to now held there once, and none other. One the system does
    // not give is asked for again only once a key is bound to it anew, and its keys work anywhere in the app still.
    function holdHotkeys() {
        const wanted = new Map();
        for (const binding of keymap.bindings) {
            if (binding.reach === 'system' && binding.active && !wanted.has(binding.chord))
                wanted.set(binding.chord, binding);
        }
        for (const [chord, off] of hotkeys) {
            if (wanted.has(chord)) continue;
            off?.();
            hotkeys.delete(chord);
        }
        for (const [chord, binding] of wanted) {
            if (hotkeys.has(chord)) continue;
            const keystroke = keystrokeOf(binding.keystroke);
            const off = KEYS.hotkey(keystroke, () => pressHotkey(keystroke));
            if (!off) LOG.warn(`${binding.label}: the system did not give ${chord} to the app outside it`);
            hotkeys.set(chord, off);
        }
    }

    // A chord held in any app, pressed: the first key on it the core lists runs, with no page, as a press in a page
    // runs the first. While a chord is recorded, it is recorded as a press in a page is.
    function pressHotkey(keystroke) {
        if (recording) return take({ type: 'keydown', ...keystroke });
        const binding = keymap.bindings.find(
            (binding) => binding.reach === 'system' && binding.active && matches(binding.keystroke, keystroke)
        );
        if (binding) run(binding, null);
    }

    // `pressed` is a key as the environment tells it (environment: keys).
    function matches(keystroke, pressed) {
        return (
            !!keystroke &&
            keystroke.code === pressed.code &&
            keystroke.meta === pressed.meta &&
            keystroke.control === pressed.control &&
            keystroke.shift === pressed.shift &&
            keystroke.alt === pressed.alt
        );
    }

    // The first that runs where the keystroke landed wins, in the order the core lists the bindings. Answers whether
    // it took the key.
    function handle(target, page, pressed) {
        if (recording) return take(pressed);
        if (pressed.type !== 'keydown') return false;
        const taken = local.get(target)?.find(({ keystroke }) => matches(keystroke, pressed));
        if (taken) {
            taken.run();
            return true;
        }
        if (page && delegated.monitor(page, keystrokeOf(pressed))) return true;
        const active = keymap.bindings.filter((binding) => binding.active && matches(binding.keystroke, pressed));
        const wide = active.find((binding) => KEY_REACH.isWide(binding.reach));
        if (wide) return run(wide, target);
        if (!page || !delegated.isActive(page)) return false;
        if (typing.has(page) && active.some(({ editsText }) => editsText)) return false;
        const mod = IDENTITY.modOf(page);
        const hit = active.find((binding) => binding.app || binding.owner === mod?.id);
        return hit ? run(hit, target) : false;
    }

    function run(binding, target) {
        if (binding.app) {
            runs.get(binding.action)?.(target);
            return true;
        }
        const page = IDENTITY.pageOf(binding.owner);
        if (!page) return false;
        PROTOCOL.key.send(page, { action: binding.action });
        return true;
    }

    // Recording happens here: a page never hears a chord already bound, and the app menu would act on
    // Command-W while a person types it into a field. It ends when the asking page goes.
    function startRecording(page) {
        stopRecording(false);
        const end = () => recording?.page === page && stopRecording(true);
        const drop = IDENTITY.whenPageEnds(page, end);
        recording = { page, drop, timer: setTimeout(end, RECORDING_MS) };
    }

    function stopRecording(tell) {
        if (!recording) return;
        const { page, drop, timer } = recording;
        clearTimeout(timer);
        drop();
        recording = null;
        if (tell) PROTOCOL.recorded.send(page, { cancel: true });
    }

    // Every keystroke is taken while recording; what one comes to is the core's to say, and the recording ends on
    // one that is a chord, cancels or clears.
    function take(pressed) {
        if (pressed.type !== 'keydown') return true;
        const asking = recording;
        CORE.request('keymap/record', { keystroke: keystrokeOf(pressed) }).then(
            (recorded) => {
                if (recording !== asking) return;
                if (!recorded.pending && !recorded.error) stopRecording(false);
                PROTOCOL.recorded.send(asking.page, recorded);
            },
            (error) => LOG.error('a key typed to be bound was not read', error)
        );
        return true;
    }

    // A key pressed, as the core and a layer read it: copied as it lands, so nothing of what the environment told is
    // kept or read after.
    function keystrokeOf({ code, meta, control, alt, shift }) {
        return Object.freeze({ code, meta, control, alt, shift });
    }

    return { start, delegate, listen, register, chordOf: chordOfApp };
}
