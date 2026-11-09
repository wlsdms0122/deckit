import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as KEY from './model/key.js';
import * as KEY_PERMISSION from './model/permission.js';

// `deckit` is what connect answered.
export function createKey({ deckit }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const KEPT = 'panel-keys';
    let set = {}; // a key's id -> the keystroke the person set for it, or null for none
    let keeping = Promise.resolve(); // the change being kept, which the next one waits for
    const held = new Map(); // a key's id -> the release of the chord it holds, for one that holds one
    const recordings = new WeakMap(); // a page that records -> { id, stop }, the recording it asked for last
    let pressed = () => false;

    // MARK: - Initializer
    // MARK: - Public
    // The shell's own keys, each with its default chord, and the chords the person set, kept in the shell's state,
    // which a mod with deckit.shell-keys lists, sets and resets. Each holds its chord in every page of the app, before
    // any mod can take one: `press(id, page) -> taken` is a press of it in `page` that the page did not handle,
    // answering whether it took it. Any mod's page records the keys pressed in it.
    function start(press) {
        pressed = press;
        set = KEY.keptOf(deckit.state.read(KEPT, {}));
        for (const { id, name } of KEY.KEYS) {
            const keystroke = keystrokeOf(id);
            try {
                if (keystroke) held.set(id, hold(id, keystroke));
            } catch (error) {
                deckit.log.warn(`the shell's ${name} has no chord: ${error.message}`);
            }
        }
        PROTOCOL.record.on(({ id }, sender) => {
            const stop = deckit.keymap.record(sender, (keystroke) => PROTOCOL.recorded.send(sender, { id, keystroke }));
            recordings.set(sender, { id, stop });
        });
        PROTOCOL.stopRecording.on(({ id }, sender) => {
            const recording = recordings.get(sender);
            if (recording?.id !== id) return;
            recordings.delete(sender);
            recording.stop();
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

    // The chord of one of the shell's keys as a person reads it, or '' for one with none.
    function chordOf(id) {
        const keystroke = KEY.KEYS.some((key) => key.id === id) ? keystrokeOf(id) : null;
        return keystroke ? KEY.written(keystroke) : '';
    }

    // MARK: - Private
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

    // The key's chord held in every page of the app, by the key's name: refused, REFUSED, for one held or taken.
    function hold(id, keystroke) {
        const { name } = KEY.KEYS.find((key) => key.id === id);
        return deckit.keymap.hold(keystroke, (page) => pressed(id, page), { name });
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

    return { start, chordOf };
}
