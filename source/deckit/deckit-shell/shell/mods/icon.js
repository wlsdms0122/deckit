import * as FIELD from '../../../deckit-sdk/shell/mods/field.js';
import * as MODS from './index.js';

// `deckit` is what connect answered.
export function createIcons({ deckit }) {
    // MARK: - Property
    const icons = new Map(); // a mod's id -> its icon, as FIELD.iconOf reads its file
    const listeners = new Set();
    let reading = Promise.resolve(); // the read under way, or the last one

    // MARK: - Initializer
    // MARK: - Public
    // The icon of each mod that loads, read from the file its manifest field `icon` names in its folder as the mods
    // are read, and again as they change. A value that names no file of the folder, or a file the shell does not draw,
    // reads as none.
    function start() {
        deckit.mods.onChange(read);
        read();
    }

    // The icon of the mod `id`, or '' where it has none, as last read.
    function of(id) {
        return icons.get(id) ?? '';
    }

    // Fulfilled once the read under way is done, so what answers a mod answers what was read.
    function ready() {
        return reading;
    }

    // Told as an icon changes. Answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    function read() {
        reading = reading.then(readAll).catch((error) => deckit.log.error('the icons were not read', error));
        return reading;
    }

    async function readAll() {
        const next = new Map();
        for (const { id } of MODS.loaded(deckit.mods)) {
            const path = FIELD.iconPathOf(deckit.mods.fieldsOf(id));
            const text = path === null ? null : await deckit.mods.readFile(id, path).catch(() => null);
            next.set(id, FIELD.iconOf(text));
        }
        const changed = next.size !== icons.size || [...next].some(([id, icon]) => icons.get(id) !== icon);
        icons.clear();
        for (const [id, icon] of next) icons.set(id, icon);
        if (changed) for (const listener of listeners) listener();
    }

    return { start, of, ready, onChange };
}
