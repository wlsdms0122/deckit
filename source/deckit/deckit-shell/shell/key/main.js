import * as CHANNEL from '../../deckit/channel/index.js';
import * as LISTENER from '../../deckit/listener/index.js';
import * as DECLARED from './protocol.js';
import * as KEY from './model/key.js';
import * as KEY_PERMISSION from './model/permission.js';

// The keys of the app, in one table of chords, a chord its first holder's at a time: one of the shell's own keys, or
// one a mod took from every page of the app with deckit.app-keys, or from every app too with system.global-keys, its
// press told to the page of the mod that took it and let go when the mod's page ends. A mod's chord is taken before the
// page has the key; one of the shell's keys runs only once the page did not handle it. A page that records is handed
// each key pressed in it, before anything else looks at it; then the monitors look at the keys pressed in the pages
// listened to, before any chord a mod took, and what hears each chord told to a mod hears it. `deckit` is what connect
// answered, and `keys` the environment's (environment: SHELL.keys).
export function createKey({ deckit, keys: KEYS }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const KEPT = 'panel-keys';
    // A chord, by its name -> { page, id, off, drop } for one a mod took, `off` the system's hold or null, or
    // { holder, handler } for one of the shell's keys, `holder` its name as a person reads it.
    const taken = new Map();
    const monitors = new Set(); // what looks at each key pressed before the chords taken, in the order it began
    const recording = new Map(); // a page that records -> { id, stop }, the recording it asked for last
    const told = new Set(); // what hears each chord told to a mod
    let set = {}; // a key's id -> the keystroke the person set for it, or null for none
    let keeping = Promise.resolve(); // the change being kept, which the next one waits for
    const held = new Map(); // a key's id -> the release of the chord it holds, for one that holds one
    let pressed = () => false;

    // MARK: - Initializer
    // MARK: - Public
    // The shell's own keys, each with its default chord, and the chords the person set, kept in the shell's state,
    // which a mod with deckit.shell-keys lists, sets and resets. Each holds its chord in every page listened to, before
    // any mod can take one: `press(id, page) -> taken` is a press of it in `page` that the page did not handle,
    // answering whether it took it. The keys are listened to in every mod's page, and any mod's page records the keys
    // pressed in it.
    function start(press) {
        pressed = press;
        PROTOCOL.take.handle(({ id, keystroke, scope }, sender) => take(sender, { id, keystroke, scope }));
        PROTOCOL.release.on(({ id }, sender) => release(sender, id));
        deckit.pages.onSandbox((page) => listen(page));
        set = KEY.keptOf(deckit.state.read(KEPT, {}));
        for (const { id, name } of KEY.KEYS) {
            const keystroke = keystrokeOf(id);
            try {
                if (keystroke) held.set(id, hold(id, keystroke));
            } catch (error) {
                deckit.log.warn(`the shell's ${name} has no chord: ${error.message}`);
            }
        }
        PROTOCOL.record.on(({ id }, sender) => record(sender, id));
        PROTOCOL.stopRecording.on(({ id }, sender) => {
            const one = recording.get(sender);
            if (one?.id === id) one.stop();
        });
        PROTOCOL.list.handle((_payload, sender) => {
            holds(sender);
            return listed();
        });
        PROTOCOL.set.handle(({ id, keystroke }, sender) => {
            holds(sender);
            const read = keystroke == null ? null : KEY.keystrokeOf(keystroke);
            if (!read && keystroke != null) throw new Error('keys.set() takes a keystroke with a code, or null');
            return change(id, read);
        });
        PROTOCOL.reset.handle(({ id }, sender) => {
            holds(sender);
            return change(id, undefined);
        });
    }

    // Keystrokes in `target`, a page of the app, go by the chords taken: one a mod took pressed there is taken from the
    // page and told to its mod, and one of the shell's keys is its once the page did not handle it.
    function listen(target) {
        KEYS.capture(target, (event) => event.type === 'keydown' && handle(target, copied(event)));
        KEYS.unhandled(target, (keystroke) => pass(target, copied(keystroke)));
    }

    // `handler(page, keystroke) -> taken` looks at each key pressed in a page listened to, `page` the one it was
    // pressed in and `keystroke` `{ code, meta, control, alt, shift }`, before any chord a mod took: answering true
    // takes it from the page, and no chord runs for it. Answers its off.
    function monitor(handler) {
        monitors.add(handler);
        return () => monitors.delete(handler);
    }

    // `listener(mod)` hears each chord a mod took as it is told to that mod's page, `mod` its id. Answers its off.
    function onChord(listener) {
        const heard = LISTENER.wrap(listener, 'a chord listener');
        told.add(heard);
        return () => told.delete(heard);
    }

    // The chord of one of the shell's keys as a person reads it, or '' for one with none.
    function chordOf(id) {
        const keystroke = KEY.KEYS.some((key) => key.id === id) ? keystrokeOf(id) : null;
        return keystroke ? KEY.written(keystroke) : '';
    }

    // MARK: - Private
    // A chord, as `page`'s mod takes it under `id`: held by the system too in `global`, where one the system does not
    // give works in every page of the app still. Answers whether it works where its scope says.
    function take(page, { id, keystroke, scope }) {
        if (!Object.hasOwn(KEY_PERMISSION.SCOPES, scope))
            throw invalid(`a chord is taken in ${Object.keys(KEY_PERMISSION.SCOPES).join(' or ')}, not ${scope}`);
        const mod = deckit.mods.modFrom(page, KEY_PERMISSION.SCOPES[scope]);
        const read = copied(keystroke);
        if (typeof read.code !== 'string' || !read.code) throw invalid('a chord names its key by its code');
        const name = nameOf(read);
        refuseTaken(name);
        if ([...taken.values()].some((one) => one.page === page && one.id === id))
            throw new Error(`${mod} took a chord under ${id} already`);
        let off = null;
        if (scope === 'global') {
            off = KEYS.hotkey(read, () => tell(name));
            if (!off) deckit.log.warn(`${mod}: the system did not give ${name} to the app outside it`);
        }
        const drop = deckit.pages.whenEnds(page, () => letGo(name));
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

    // The key's chord held in every page listened to, by the key's name: refused, REFUSED, for one held or taken.
    // Answers its release.
    function hold(id, keystroke) {
        const { name: holder } = KEY.KEYS.find((key) => key.id === id);
        const chord = nameOf(keystroke);
        refuseTaken(chord);
        const one = { holder, handler: (page) => pressed(id, page) };
        taken.set(chord, one);
        return () => {
            if (taken.get(chord) === one) taken.delete(chord);
        };
    }

    // `page` records under `id`: each key pressed in it is taken from it and told it, until its stop, its next
    // record or its end.
    function record(page, id) {
        recording.get(page)?.stop();
        const one = { id, stop: null };
        const drop = deckit.pages.whenEnds(page, () => one.stop());
        one.stop = () => {
            if (recording.get(page) !== one) return;
            recording.delete(page);
            drop();
        };
        recording.set(page, one);
    }

    function refuseTaken(name) {
        const holder = taken.get(name);
        if (!holder) return;
        const by = holder.holder ?? (deckit.mods.modOf(holder.page) || 'a mod');
        throw Object.assign(new Error(`${name} is taken by ${by}`), { stage: 'call', kind: 'REFUSED' });
    }

    function invalid(message) {
        return Object.assign(new Error(message), { stage: 'call', kind: 'INVALID_ARGUMENT' });
    }

    // The page's recording first, then the monitors, in order, then the chords mods took: answers whether the key was
    // taken. A monitor that throws takes nothing.
    function handle(page, keystroke) {
        const recorder = recording.get(page);
        if (recorder) {
            PROTOCOL.recorded.send(page, { id: recorder.id, keystroke });
            return true;
        }
        for (const handler of monitors) {
            try {
                if (handler(page, keystroke)) return true;
            } catch (error) {
                deckit.log.error('a key monitor failed', error);
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

    // A key the page did not handle, to the shell's key that holds its chord: answers whether it took it. One that
    // throws takes nothing.
    function pass(page, keystroke) {
        const name = nameOf(keystroke);
        const one = taken.get(name);
        if (!one?.handler) return false;
        try {
            return !!one.handler(page, keystroke);
        } catch (error) {
            deckit.log.error(`what holds ${name} failed`, error);
            return false;
        }
    }

    function tell(name) {
        const one = taken.get(name);
        if (!one) return;
        PROTOCOL.pressed.send(one.page, { id: one.id });
        const mod = deckit.mods.modOf(one.page);
        if (mod) for (const listener of [...told]) listener(mod);
    }

    // A key pressed, copied as it lands, so nothing of what the environment or a page told is kept or read after.
    function copied({ code, meta, control, alt, shift }) {
        return Object.freeze({ code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift });
    }

    // A chord as a log reads it, and as the chords taken are told apart.
    function nameOf({ code, meta, control, alt, shift }) {
        const modifiers = [
            [control, 'Control'],
            [alt, 'Alt'],
            [shift, 'Shift'],
            [meta, 'Meta'],
        ];
        return [...modifiers.filter(([on]) => on).map(([, label]) => label), code].join('+');
    }

    // The chord the key has now: the one the person set, or its default.
    function keystrokeOf(id) {
        return Object.hasOwn(set, id) ? set[id] : KEY.KEYS.find((key) => key.id === id).keystroke;
    }

    function listed() {
        return KEY.KEYS.map(entryOf);
    }

    function entryOf({ id, name, keystroke }) {
        return { id, name, defaultKeystroke: keystroke, keystroke: keystrokeOf(id) };
    }

    // `keystroke`, or null for none, set for the key, or undefined for its default again. Worn only once kept: a
    // change the core refuses leaves the keys as they were. A chord is one key's at a time, and none a mod holds.
    function change(id, keystroke) {
        const key = KEY.KEYS.find((one) => one.id === id);
        if (!key) throw new Error(`${id} is none of the shell's keys`);
        const kept = keeping.then(async () => {
            const chord = keystroke === undefined ? key.keystroke : keystroke;
            const holder = chord && KEY.KEYS.find((one) => one.id !== id && KEY.same(keystrokeOf(one.id), chord));
            if (holder) refuse(`${KEY.written(chord)} is the chord of ${holder.name}`);
            const now = keystrokeOf(id);
            const same = chord === now || KEY.same(chord, now);
            const release = !same && chord ? hold(id, chord) : null;
            const next = { ...set };
            if (keystroke === undefined) delete next[id];
            else next[id] = keystroke;
            try {
                await deckit.state.write(KEPT, next);
            } catch (error) {
                release?.();
                throw error;
            }
            set = next;
            if (!same) {
                held.get(id)?.();
                if (release) held.set(id, release);
                else held.delete(id);
            }
            return entryOf(key);
        });
        keeping = kept.catch(() => {});
        return kept;
    }

    // Held to the permission: main does not take a page's word for it.
    function holds(page) {
        const modId = deckit.mods.modOf(page);
        if (deckit.mods.runOf(modId)?.granted.includes(KEY_PERMISSION.SHELL_KEYS)) return;
        const refused = new Error(`${modId || 'the page'} does not have the ${KEY_PERMISSION.SHELL_KEYS} permission`);
        throw Object.assign(refused, { kind: 'NOT_PERMITTED' });
    }

    function refuse(why) {
        throw Object.assign(new Error(why), { kind: 'REFUSED' });
    }

    return { start, listen, monitor, onChord, chordOf };
}
