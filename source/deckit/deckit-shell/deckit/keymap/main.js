import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as KEYS_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The keys a mod cannot take alone: a chord taken from every page of the app with deckit.app-keys, or from every app
// too with system.global-keys, its press told to the page of the mod that took it, let go when the mod's page ends. A
// layer over deckit holds a chord in every page of the app too, in the same table: a chord is its first holder's, a
// layer's or one mod's, at a time. A mod's chord is taken before the page has the key; a layer's runs only once the
// page did not handle it. A page that records is handed each key pressed in it, before anything else looks at it; then
// a layer over deckit monitors the keys pressed in those pages, before any chord a mod took. `keys` is the
// environment's.
export function createKeymap({ LOG, IDENTITY, keys: KEYS }) {
    // MARK: - Property
    // A chord, by its name -> { page, id, off, drop } for one a mod took, `off` the system's hold or null, or
    // { holder, handler } for one a layer holds, `holder` its name as a person reads it.
    const taken = new Map();
    const monitors = new Set(); // what looks at each key pressed before the chords taken, in the order it began
    const recording = new Map(); // a page that records -> { handler, stop }

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.take.handle(({ id, keystroke, scope }, sender) => take(sender, { id, keystroke, scope }));
        PROTOCOL.release.on(({ id }, sender) => release(sender, id));
    }

    // Keystrokes in `target`, a page of the app, go by the chords taken: one a mod took pressed there is taken from the
    // page and told to its mod, and one a layer holds is its once the page did not handle it. Deckit listens on the
    // pages mods run in and the web pages they show; an app hands its own.
    function listen(target) {
        KEYS.capture(target, (pressed) => pressed.type === 'keydown' && handle(target, keystrokeOf(pressed)));
        KEYS.unhandled(target, (pressed) => pass(target, keystrokeOf(pressed)));
    }

    // `handler(page, keystroke) -> taken` looks at each key pressed in a page listened to, `page` the one it was
    // pressed in and `keystroke` `{ code, meta, control, alt, shift }`, before any chord a mod took: answering true
    // takes it from the page, and no chord runs for it. Answers its off.
    function monitor(handler) {
        monitors.add(handler);
        return () => monitors.delete(handler);
    }

    // `keystroke` held in every page listened to by `name`, its holder as a person reads it: `handler(page, keystroke)
    // -> taken` is each press of it the page did not handle, after the page had it, answering whether it took it from
    // the rest of the app. Refused, REFUSED, for a chord held or taken already. Answers its release.
    function hold(keystroke, handler, { name } = {}) {
        if (typeof handler !== 'function') throw new Error('a chord is held with a function');
        const read = keystrokeOf(keystroke ?? {});
        if (typeof read.code !== 'string' || !read.code) throw new Error('a chord names its key by its code');
        const chord = nameOf(read);
        refuseTaken(chord);
        const one = { holder: String(name), handler };
        taken.set(chord, one);
        return () => {
            if (taken.get(chord) === one) taken.delete(chord);
        };
    }

    // `page` records: each key pressed in it is taken from it and handed to `handler(keystroke)` alone, until the
    // answered stop, its next record or its end. Answers the stop.
    function record(page, handler) {
        recording.get(page)?.stop();
        const one = { handler, stop: null };
        const drop = IDENTITY.whenPageEnds(page, () => one.stop());
        one.stop = () => {
            if (recording.get(page) !== one) return;
            recording.delete(page);
            drop();
        };
        recording.set(page, one);
        return one.stop;
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
        refuseTaken(name);
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

    function refuseTaken(name) {
        const holder = taken.get(name);
        if (!holder) return;
        const by = holder.holder ?? (IDENTITY.modOf(holder.page)?.id || 'a mod');
        throw Object.assign(new Error(`${name} is taken by ${by}`), { kind: 'REFUSED' });
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

    // The page's recording first, then the monitors, in order, then the chords mods took: answers whether the key was
    // taken. A monitor that throws takes nothing.
    function handle(page, keystroke) {
        const recorder = recording.get(page);
        if (recorder) {
            try {
                recorder.handler(keystroke);
            } catch (error) {
                LOG.error('a recording failed', error);
            }
            return true;
        }
        for (const handler of monitors) {
            try {
                if (handler(page, keystroke)) return true;
            } catch (error) {
                LOG.error('a key monitor failed', error);
            }
        }
        return press(keystroke);
    }

    // Answers whether a chord a mod took was pressed, which is taken.
    function press(keystroke) {
        const name = nameOf(keystroke);
        const one = taken.get(name);
        if (!one || one.handler) return false;
        tell(name);
        return true;
    }

    // A key the page did not handle, to the layer that holds its chord: answers whether its handler took it. A holder
    // that throws takes nothing.
    function pass(page, keystroke) {
        const name = nameOf(keystroke);
        const one = taken.get(name);
        if (!one?.handler) return false;
        try {
            return !!one.handler(page, keystroke);
        } catch (error) {
            LOG.error(`what holds ${name} failed`, error);
            return false;
        }
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

    return { start, listen, monitor, hold, record };
}
