import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as KEYS_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The keys a mod cannot take alone: a chord taken from every page of the app with deckit.app-keys, or from every app
// too with system.global-keys, its press told to the page of the mod that took it. A chord is one mod's at a time, and
// let go when the mod's page ends. A layer over deckit monitors the keys pressed in those pages before any chord
// taken. `keys` is the environment's.
export function createKeymap({ LOG, IDENTITY, keys: KEYS }) {
    // MARK: - Property
    const taken = new Map(); // a chord, by its name -> { page, id, off, drop }, `off` the system's hold or null
    const monitors = new Set(); // what looks at each key pressed before the chords taken, in the order it began

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.take.handle(({ id, keystroke, scope }, sender) => take(sender, { id, keystroke, scope }));
        PROTOCOL.release.on(({ id }, sender) => release(sender, id));
    }

    // Keystrokes in `target`, a page of the app, go by the chords taken: one pressed there is taken from the page and
    // told to its mod. Deckit listens on the pages mods run in and the web pages they show; an app hands its own.
    function listen(target) {
        KEYS.capture(target, (pressed) => pressed.type === 'keydown' && handle(target, keystrokeOf(pressed)));
    }

    // `handler(page, keystroke) -> taken` looks at each key pressed in a page listened to, `page` the one it was
    // pressed in and `keystroke` `{ code, meta, control, alt, shift }`, before any chord taken: answering true takes
    // it from the page, and no chord runs for it. Answers its off.
    function monitor(handler) {
        monitors.add(handler);
        return () => monitors.delete(handler);
    }

    // MARK: - Private
    // A chord, as `page`'s mod takes it under `id`: held by the system too in `global`, where one the system does not
    // give works in every page of the app still. Answers whether it works where its scope says.
    function take(page, { id, keystroke, scope }) {
        if (!Object.hasOwn(KEYS_PERMISSION.SCOPES, scope))
            throw new Error(`a chord is taken in ${Object.keys(KEYS_PERMISSION.SCOPES).join(' or ')}, not ${scope}`);
        const mod = IDENTITY.modFrom(page, KEYS_PERMISSION.SCOPES[scope]);
        const read = keystrokeOf(keystroke);
        if (typeof read.code !== 'string' || !read.code) throw new Error('a chord names its key by its code');
        const name = nameOf(read);
        const holder = taken.get(name);
        if (holder) {
            const by = IDENTITY.modOf(holder.page)?.id || 'a mod';
            throw Object.assign(new Error(`${name} is taken by ${by}`), { kind: 'REFUSED' });
        }
        if ([...taken.values()].some((one) => one.page === page && one.id === id))
            throw new Error(`${mod.id} took a chord under ${id} already`);
        let off = null;
        if (scope === 'global') {
            off = KEYS.hotkey(read, () => tell(name));
            if (!off) LOG.warn(`${mod.id}: the system did not give ${name} to the app outside it`);
        }
        const drop = IDENTITY.whenPageEnds(page, () => letGo(name));
        taken.set(name, { page, id, off, drop });
        return scope !== 'global' || !!off;
    }

    function release(page, id) {
        for (const [name, one] of taken) if (one.page === page && one.id === id) letGo(name);
    }

    function letGo(name) {
        const one = taken.get(name);
        if (!one) return;
        taken.delete(name);
        one.off?.();
        one.drop();
    }

    // The monitors first, in order, then the chords taken: answers whether the key was taken. A monitor that throws
    // takes nothing.
    function handle(page, keystroke) {
        for (const handler of monitors) {
            try {
                if (handler(page, keystroke)) return true;
            } catch (error) {
                LOG.error('a key monitor failed', error);
            }
        }
        return press(keystroke);
    }

    // Answers whether a chord taken was pressed.
    function press(keystroke) {
        const name = nameOf(keystroke);
        if (!taken.has(name)) return false;
        tell(name);
        return true;
    }

    function tell(name) {
        const one = taken.get(name);
        if (one) PROTOCOL.key.send(one.page, { id: one.id });
    }

    // A key pressed, copied as it lands, so nothing of what the environment or a page told is kept or read after.
    function keystrokeOf({ code, meta, control, alt, shift }) {
        return Object.freeze({ code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift });
    }

    // A chord as a log reads it, and as the chords taken are told apart.
    function nameOf({ code, meta, control, alt, shift }) {
        const held = [
            [control, 'Control'],
            [alt, 'Alt'],
            [shift, 'Shift'],
            [meta, 'Meta'],
        ];
        return [...held.filter(([on]) => on).map(([, label]) => label), code].join('+');
    }

    return { start, listen, monitor };
}
