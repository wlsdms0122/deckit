import * as CHANNEL from '../../deckit-driver/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';
import * as KEYMAP_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Keys, as the core resolves them: the core keeps the keymap and says how each binding stands, and a keystroke is
// resolved here against the copy it last told, where the keystroke lands.
export function createKeymap({ LOG, IDENTITY, CATALOG, RUNNER, CORE }) {
    // MARK: - Property
    const RECORDING_MS = 20 * 1000;
    const runs = new Map(); // action -> run(webContents), of the keys registered through what connect answers
    const typing = new Set(); // webContents ids with a field focused
    const local = new Map(); // webContents id -> [{ keystroke, run }], taken there before anything else
    let keymap = { revision: 0, bindings: [] };
    let recording = null; // { webContents, drop, timer }
    let delegated = { isActive: () => false, monitor: () => false };

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.handleEffect('bindingsChanged', ({ revision, bindings }) => keep({ revision, bindings }));
        PROTOCOL.typing.on(({ on }, sender) => {
            if (on) typing.add(sender.id);
            else typing.delete(sender.id);
        });
        PROTOCOL.record.on(({ on }, sender) => {
            IDENTITY.modFrom(sender, KEYMAP_PERMISSION.KEY_MAP);
            if (on) startRecording(sender);
            else if (recording?.webContents === sender) stopRecording(false);
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

    // Keystrokes in this webContents go through the key map. deckit listens on its own pages and the web pages they
    // show; an app hands its own where deckit's global keys should work too. `page` is the deckit page a keystroke
    // here belongs to, as web answers it, or null: the keys of the page in front run only in one. `keys` are this
    // webContents' own, taken there first: only a chord main catches wins over a meaning the app's menu gives it.
    function listen(webContents, { keys = [], page = null } = {}) {
        if (keys.length)
            CORE.request('keymap/keystrokes', { specs: keys.map(({ key }) => String(key)) }).then(
                (keystrokes) => {
                    if (webContents.isDestroyed()) return;
                    const read = keys.map(({ run }, index) => ({ keystroke: keystrokes[index], run }));
                    local.set(
                        webContents.id,
                        read.filter(({ keystroke }) => keystroke)
                    );
                },
                (error) => LOG.error("a page's own keys were not read", error)
            );
        LOG.guard(webContents, 'before-input-event', (event, input) => {
            if (handle(webContents, page, input)) event.preventDefault();
        });
        const forget = () => typing.delete(webContents.id);
        webContents.once('destroyed', () => local.delete(webContents.id));
        // A reload or a crashed renderer keeps the webContents and its id, but the page's state is gone.
        LOG.guard(webContents, 'did-navigate', forget);
        LOG.guard(webContents, 'render-process-gone', forget);
        webContents.once('destroyed', forget);
    }

    // A key registered through what connect answers, run by whoever registered it: the host app, or the shell it put
    // on deckit. `global` ones work anywhere a webContents is listened to; the rest only in the page in front.
    function register({ action, key, label = '', global = false, run }) {
        runs.set(action, run);
        CORE.request('keymap/register', { action, key: String(key), label: String(label), global: !!global }).then(
            keep,
            (error) => LOG.error(`the key ${action} was not registered`, error)
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
        for (const mod of CATALOG.mods()) {
            const page = IDENTITY.pageOf(mod.id);
            if (page) PROTOCOL.changed.send(page, {});
        }
    }

    // `input` has Electron's before-input-event shape.
    function matches(keystroke, input) {
        return (
            !!keystroke &&
            keystroke.code === input.code &&
            keystroke.meta === !!input.meta &&
            keystroke.control === !!input.control &&
            keystroke.shift === !!input.shift &&
            keystroke.alt === !!input.alt
        );
    }

    // The first that runs where the keystroke landed wins, in the order the core lists the bindings.
    function handle(webContents, page, input) {
        if (recording) return take(input);
        if (input.type !== 'keyDown') return false;
        const taken = local.get(webContents.id)?.find(({ keystroke }) => matches(keystroke, input));
        if (taken) {
            taken.run();
            return true;
        }
        if (page && delegated.monitor(page, keystrokeOf(input))) return true;
        const active = keymap.bindings.filter((binding) => binding.active && matches(binding.keystroke, input));
        const global = active.find((binding) => binding.scope === 'global');
        if (global) return run(global, webContents);
        if (!page || !delegated.isActive(page)) return false;
        if (typing.has(page.id) && active.some(({ editsText }) => editsText)) return false;
        const mod = IDENTITY.modOf(page);
        const hit = active.find((binding) => binding.scope === 'app' || binding.owner === mod?.id);
        return hit ? run(hit, webContents) : false;
    }

    function run(binding, webContents) {
        if (binding.app) {
            runs.get(binding.action)?.(webContents);
            return true;
        }
        const page = IDENTITY.pageOf(binding.owner);
        if (!page) return false;
        PROTOCOL.key.send(page, { action: binding.action });
        return true;
    }

    // Recording happens here: a page never hears a chord already bound, and the app menu would act on
    // Command-W while a person types it into a field. It ends when the asking page goes.
    function startRecording(webContents) {
        stopRecording(false);
        const end = () => recording?.webContents === webContents && stopRecording(true);
        const drop = IDENTITY.whenPageEnds(webContents, end);
        recording = { webContents, drop, timer: setTimeout(end, RECORDING_MS) };
    }

    function stopRecording(tell) {
        if (!recording) return;
        const { webContents, drop, timer } = recording;
        clearTimeout(timer);
        drop();
        recording = null;
        if (tell) PROTOCOL.recorded.send(webContents, { cancel: true });
    }

    // Every keystroke is taken while recording; what one comes to is the core's to say, and the recording ends on
    // one that is a chord, cancels or clears.
    function take(input) {
        if (input.type !== 'keyDown') return true;
        const asking = recording;
        CORE.request('keymap/record', { keystroke: keystrokeOf(input) }).then(
            (recorded) => {
                if (recording !== asking) return;
                if (!recorded.pending && !recorded.error) stopRecording(false);
                PROTOCOL.recorded.send(asking.webContents, recorded);
            },
            (error) => LOG.error('a key typed to be bound was not read', error)
        );
        return true;
    }

    // A key pressed, as the core and a layer read it: copied as it lands, so nothing of Electron's input is kept or
    // read after.
    function keystrokeOf({ code, meta, control, alt, shift }) {
        return Object.freeze({ code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift });
    }

    return { start, delegate, listen, register, chordOf: chordOfApp };
}
