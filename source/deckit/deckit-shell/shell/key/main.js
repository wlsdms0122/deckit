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

    // MARK: - Initializer
    // MARK: - Public
    // The shell's own keys, each with its default chord, and the chords the person set, kept in the shell's state,
    // which a mod with deckit.shell-keys lists, sets and resets.
    function start() {
        set = KEY.keptOf(deckit.state.read(KEPT, {}));
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

    // The id of the shell's key whose chord `keystroke` is, or null.
    function idOf(keystroke) {
        const pressed = KEY.keystrokeOf(keystroke);
        return KEY.KEYS.find(({ id }) => KEY.same(keystrokeOf(id), pressed))?.id ?? null;
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

    // `keystroke`, or null for none, set for the key, or undefined for its default again. Worn only once kept: a
    // change the core refuses leaves the keys as they were. A chord is one key's at a time.
    function change(id, keystroke) {
        const key = KEY.KEYS.find((one) => one.id === id);
        if (!key) throw new Error(`${id} is none of the shell's keys`);
        const kept = keeping.then(async () => {
            const chord = keystroke === undefined ? key.keystroke : keystroke;
            const holder = chord && KEY.KEYS.find((one) => one.id !== id && KEY.same(keystrokeOf(one.id), chord));
            if (holder) refuse(`${KEY.written(chord)} is the chord of ${holder.name}`);
            const next = { ...set };
            if (keystroke === undefined) delete next[id];
            else next[id] = keystroke;
            await deckit.state.write(KEPT, next);
            set = next;
            return entryOf(key);
        });
        keeping = kept.catch(() => {});
        return kept;
    }

    // Held to the permission: main does not take a page's word for it.
    function holds(page) {
        const modId = deckit.mods.modOf(page);
        const permissions = deckit.mods.runOf(modId)?.mod.permissions || [];
        if (permissions.some(({ id }) => id === KEY_PERMISSION.SHELL_KEYS)) return;
        refuse(`${modId || 'the page'} does not have the ${KEY_PERMISSION.SHELL_KEYS} permission`);
    }

    function refuse(why) {
        throw Object.assign(new Error(why), { kind: 'REFUSED' });
    }

    return { start, idOf, chordOf };
}
