const { settingsOf, problemOfValue, valueOf } = require('../setting/setting.js');

// MARK: - Property
const INTERFACE = 'deckit/configuration';
// What a client holds to list every mod's settings and set one of another mod's.
const SYSTEM_SERVICES = 'deckit.system-services';

// MARK: - Initializer
// MARK: - Public
// The settings mods declare to deckit/configuration, read from what is declared on each ask, with the values set
// kept in the mod's records, one record for each mod id, key -> value. Each change is told to the listeners of the
// connections of the mod whose setting it is. `deckit` is the function lifecycle's handle.
function configuration(deckit) {
    // MARK: - Property
    const records = deckit.storage.records;
    const warned = new Set(); // what was told about a declaration, told once
    const kept = new Map(); // mod id -> what is kept for it, key -> value, as read or last written
    const hearing = new Map(); // connection -> { mod, listeners }, the mod its credential names
    let queue = Promise.resolve(); // the work under way, which the next waits for

    // MARK: - Public
    // The exports for a connection: any client reads, sets and hears its own mod's settings, the one its credential
    // names, and one that does not hold deckit.system-services is refused the rest, kind `REFUSED`.
    function exportsFor(connection) {
        const own = connection.credential.mod;
        const get = (key) => serial(async () => valueOf(await settingOf(own, key), keptOf(own)));
        const values = () =>
            serial(async () => {
                const declared = (await settings()).filter((setting) => setting.mod.id === own);
                return Object.fromEntries(declared.map((setting) => [setting.key, valueOf(setting, keptOf(own))]));
            });
        const set = (key, value) => setFor(own, key, value);
        const onChange = async (listener) => {
            if (typeof listener !== 'function') throw new Error('onChange() takes a function');
            if (!hearing.has(connection)) hearing.set(connection, { mod: own, listeners: [] });
            hearing.get(connection).listeners.push(listener);
        };
        if (connection.credential.permissions.includes(SYSTEM_SERVICES))
            return Object.freeze({ get, values, set, onChange, list, setOf: setFor });
        const refuse = async () => {
            throw refusal('REFUSED', `${connection.mod.name} does not hold ${SYSTEM_SERVICES}`);
        };
        return Object.freeze({ get, values, set, onChange, list: refuse, setOf: refuse });
    }

    // The connection has ended: its listeners hear no more.
    function forget(connection) {
        hearing.delete(connection);
    }

    // Every mod that declares a setting, in the mods' order, and the entries left out, `{ mods, refused }`: `mods`
    // `[{ mod, items: [{ entry, value }] }]`, `refused` `[{ mod, entry, problem }]`.
    function list() {
        return serial(async () => {
            const read = await declarations();
            const byMod = new Map(); // mod id -> { mod, items }
            for (const setting of read.settings) {
                const { mod, entry } = setting;
                if (!byMod.has(mod.id)) byMod.set(mod.id, { mod, items: [] });
                byMod.get(mod.id).items.push({ entry, value: valueOf(setting, keptOf(mod.id)) });
            }
            return { mods: [...byMod.values()], refused: read.refused };
        });
    }

    // The setting `key` of the mod `mod` set to `value`, or unset for null so it reads as its default: answers the
    // value it reads as now, and tells the mod's listeners where that changed.
    function setFor(mod, key, value) {
        return serial(async () => {
            const setting = await settingOf(mod, key);
            if (value != null) {
                const problem = problemOfValue(setting, value);
                if (problem) throw refusal('VALUE', `${setting.entry.title} cannot be set: ${problem}`);
            }
            const before = valueOf(setting, keptOf(mod));
            const next = { ...keptOf(mod) };
            if (value == null) delete next[key];
            else next[key] = value;
            await records.set(mod, next);
            kept.set(mod, next);
            const now = valueOf(setting, next);
            if (now !== before) tell(mod, key, now);
            return now;
        });
    }

    // MARK: - Private
    // The settings and the entries left out, as `settingsOf` reads them from what is declared now.
    async function declarations() {
        const read = settingsOf(await deckit.exports.contributions(INTERFACE));
        for (const { mod, problem } of read.refused) warn(`${mod.id}: ${problem}`);
        return read;
    }

    async function settings() {
        return (await declarations()).settings;
    }

    async function settingOf(mod, key) {
        const setting = (await settings()).find((each) => each.mod.id === mod && each.key === key);
        if (!setting) throw refusal('KEY', `${mod} declares no setting "${key}"`);
        return setting;
    }

    // What is kept for the mod `mod`, key -> value: a record of another shape holds nothing.
    function keptOf(mod) {
        if (!kept.has(mod)) {
            const read = records.get(mod, {});
            kept.set(mod, read && typeof read === 'object' && !Array.isArray(read) ? read : {});
        }
        return kept.get(mod);
    }

    // `key` of the mod `mod` reads as `value` now: each listener of its connections hears it. What a listener throws,
    // or a connection that ended, is told no one.
    function tell(mod, key, value) {
        for (const heard of hearing.values()) {
            if (heard.mod !== mod) continue;
            for (const listener of heard.listeners)
                Promise.resolve()
                    .then(() => listener(key, value))
                    .catch(() => {});
        }
    }

    function serial(work) {
        const run = queue.then(work);
        queue = run.catch(() => {});
        return run;
    }

    function warn(problem) {
        if (warned.has(problem)) return;
        warned.add(problem);
        console.warn(`[configuration] ${problem}`);
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    return Object.freeze({ exportsFor, forget });
}

module.exports = { configuration, INTERFACE };
