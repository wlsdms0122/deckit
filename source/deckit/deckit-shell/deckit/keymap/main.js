import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as KEYMAP_PERMISSION from './model/permission.js';
import * as KEY_SCOPE from './model/scope.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Keys, as the core resolves them: the core keeps the keymap and says how each binding stands, and a keystroke is
// resolved here against the copy it last told, where the keystroke lands. `pages` and `keys` are the environment's.
export function createKeymap({ LOG, IDENTITY, CATALOG, RUNNER, CORE, WINDOW, pages: PAGES, keys: KEYS }) {
    // MARK: - Property
    const RECORDING_MS = 20 * 1000;
    const hotkeys = new Map(); // chord -> its off, or null where the system did not give it, as each is held in any app
    const typing = new WeakSet(); // pages with a field focused
    const local = new Map(); // page -> [{ keystroke, run }], taken there before anything else
    const hosts = new Map(); // a host's name, as its provider -> Map of name -> run, as it registered its keys here
    const listened = new WeakMap(); // page -> the deckit page a keystroke there belongs to, or null
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
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEYMAP);
            if (on) startRecording(sender);
            else if (recording?.page === sender) stopRecording(false);
        });
        PROTOCOL.chord.handle(({ name, provider }, sender) => chordOf(provider || IDENTITY.modFrom(sender).id, name));
        PROTOCOL.bindings.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEYMAP);
            return keymap.bindings;
        });
        PROTOCOL.bind.handle(async ({ id, spec }, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEYMAP);
            keep(await CORE.request('keymap/bind', { id, spec }));
            return true;
        });
        PROTOCOL.reset.handle(async ({ id }, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEYMAP);
            keep(await CORE.request('keymap/reset', { id }));
            return true;
        });
    }

    // What the key map asks the shell of a deckit page a keystroke landed in: `isActive(page)`, whether it is the
    // shell's page in front, where the mod's own keys and the hosts' run, as they do in a mod's window on screen;
    // `monitor(page, keystroke)`, the shell's look at the key pressed before any binding, `{ code, meta, control,
    // alt, shift }`, taking it by answering true.
    function delegate({ isActive, monitor }) {
        delegated = { isActive, monitor };
    }

    // Keystrokes in `target`, a page, go through the key map. deckit listens on its own pages and the web pages they
    // show; an app hands its own where deckit's keys that work anywhere in the app should work too. `page` is the
    // deckit page a keystroke here belongs to, as web answers it, or null: the keys of the page in front run only in
    // one. `keys` are the target's own, taken there first: only a chord main catches wins over a meaning the app's menu
    // gives it.
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
        listened.set(target, page);
        KEYS.capture(target, (keystroke) => handle(target, page, keystroke));
        // A replaced document or an ended process keeps the page, but what the page had focused is gone.
        const forget = () => typing.delete(target);
        PAGES.watch(target, {
            ended: forget,
            gone: forget,
            destroyed: () => {
                destroyed = true;
                local.delete(target);
                listened.delete(target);
                forget();
            },
        });
    }

    // A host's keys, under `provider`, a name of its own that starts with "@": { name: { label, key, scope, run } },
    // `run()` what pressing it does, here. By its `scope` a key works in the page in front, anywhere a page is listened
    // to, or in every app too. Resolves once the core has them, and rejects with why it refused one, as one with no
    // label.
    async function register(provider, keys) {
        for (const [name, { label = '', key = '', scope = 'local', run } = {}] of Object.entries(keys || {})) {
            if (typeof run !== 'function') throw new Error(`[deckit] the key ${provider}.${name} needs a run`);
            if (!KEY_SCOPE.SCOPES.includes(scope))
                throw new Error(`[deckit] the key ${provider}.${name} has no scope ${scope}`);
            // Kept before the core has it, so a key the core binds already runs here; a refusal leaves what was there.
            const held = hosts.get(provider) || new Map();
            const before = held.get(name);
            hosts.set(provider, held.set(name, run));
            try {
                keep(
                    await CORE.request('keymap/register', {
                        provider,
                        key: { name, label: String(label), key: String(key), scope },
                    })
                );
            } catch (error) {
                if (before) held.set(name, before);
                else held.delete(name);
                if (!held.size) hosts.delete(provider);
                throw error;
            }
        }
    }

    // The chord `provider`'s key `name` is bound to now, as a person reads it, or ''.
    function chordOf(provider, name) {
        return (
            keymap.bindings.find((binding) => binding.provider === provider && binding.name === name && binding.active)
                ?.chord || ''
        );
    }

    // MARK: - Private

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
            if (binding.scope === 'global' && binding.active && !wanted.has(binding.chord))
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

    // A chord held in any app, pressed: in a page listened to that has the keyboard it lands there, as a press in the
    // page does, so a narrower key on it wins there; elsewhere the first key on it the core lists that works in every
    // app runs, with no page. While a chord is recorded, it is recorded as a press in a page is.
    function pressHotkey(keystroke) {
        const pressed = { type: 'keydown', ...keystroke };
        if (recording) return take(pressed);
        const target = KEYS.focused();
        if (listened.has(target)) return handle(target, listened.get(target), pressed);
        const binding = keymap.bindings.find(
            (binding) => binding.scope === 'global' && binding.active && matches(binding.keystroke, keystroke)
        );
        if (binding) run(binding);
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

    // The first binding on the chord that works where the keystroke landed wins, in the order the core lists them, the
    // narrowest scope first. Answers whether it took the key.
    function handle(target, page, pressed) {
        if (recording) return take(pressed);
        if (pressed.type !== 'keydown') return false;
        const taken = local.get(target)?.find(({ keystroke }) => matches(keystroke, pressed));
        if (taken) {
            taken.run();
            return true;
        }
        if (page && delegated.monitor(page, keystrokeOf(pressed))) return true;
        const hit = keymap.bindings.find(
            (binding) => binding.active && matches(binding.keystroke, pressed) && worksIn(binding, page)
        );
        return hit ? run(hit) : false;
    }

    // Whether a binding works where a keystroke landed, in `page`, the deckit page, or null in another the app hands:
    // one past its page wherever a page is listened to, one in the page in front only there, a mod's in its own page,
    // and not on a chord a field focused there takes.
    function worksIn(binding, page) {
        if (KEY_SCOPE.isWide(binding.scope)) return true;
        if (!page || !(WINDOW.isActive(page) || delegated.isActive(page))) return false;
        if (binding.takenByFields && typing.has(page)) return false;
        return hosts.has(binding.provider) || binding.provider === IDENTITY.modOf(page)?.id;
    }

    // A host's key runs here, what it throws logged, and a mod's in its page, which drops it behind a dialog.
    function run(binding) {
        if (hosts.has(binding.provider)) {
            (async () => hosts.get(binding.provider).get(binding.name)())().catch((error) =>
                LOG.warn(`${binding.id} did not run`, error)
            );
            return true;
        }
        const page = IDENTITY.pageOf(binding.provider);
        if (!page) return false;
        PROTOCOL.key.send(page, { name: binding.name });
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

    return { start, delegate, listen, register, chordOf };
}
