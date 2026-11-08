const { handlersOf, listsOf, routeOf } = require('../handler/handler.js');
const { schemeOf } = require('../pattern/pattern.js');

// MARK: - Property
const INTERFACE = 'deckit/urls';
// What a client holds to list the schemes and choose the mod for one.
const SYSTEM_SERVICES = 'deckit.system-services';
// What a client holds to have a file opened.
const FILE_HANDLERS = 'system.file-handlers';
// The record of the choices: scheme -> `{ mod: id }` or `{ system: true }`.
const KEPT = 'chosen';
// The signals of the interface after which what is declared to it is read again.
const SIGNALS = ['contributions-changed', 'owner-changed'];

// MARK: - Initializer
// MARK: - Public
// The addresses mods declare to deckit/urls, read as it starts and again on the interface's signals: an address opened
// is offered to the mods that open it in turn, each reached by its id, and opened outside the app when none takes it.
// The choices are kept in the mod's records. `deckit` is the function lifecycle's handle.
function router(deckit) {
    // MARK: - Property
    const { dependencies } = deckit;
    const records = deckit.storage.records;
    const warned = new Set(); // what was told about a declaration, told once
    let chosen = choicesOf(records.get(KEPT, {}));
    let declared = read(); // what is declared to deckit/urls, as last read
    let queue = Promise.resolve(); // the choice under way, which the next waits for

    // MARK: - Initializer
    for (const signal of SIGNALS) deckit.events.on(`${INTERFACE}:${signal}`, () => (declared = read()));

    // MARK: - Public
    // The exports for a connection: any client opens an address, and one that does not hold system.file-handlers is
    // refused a file, and one that does not hold deckit.system-services the rest, kind `NOT_PERMITTED`.
    function exportsFor(connection) {
        const { permissions } = connection.credential;
        const opensFiles = permissions.includes(FILE_HANDLERS);
        const open = async (url, options) => openFor(url, options, opensFiles);
        if (permissions.includes(SYSTEM_SERVICES)) return Object.freeze({ open, list, choose });
        const refuse = async () => {
            throw refusal('NOT_PERMITTED', `${connection.mod.name} does not hold ${SYSTEM_SERVICES}`);
        };
        return Object.freeze({ open, list: refuse, choose: refuse });
    }

    // Every scheme with a list, as `listsOf` answers them, and the entries left out, `{ schemes, refused }`.
    async function list() {
        const read = await declarations();
        return { schemes: listsOf(read.handlers, chosen), refused: read.refused };
    }

    // The choice for `scheme`, `{ mod: id }`, `{ system: true }`, or none where it is left out: answers the scheme as
    // `list` does.
    function choose(scheme, choice) {
        if (typeof scheme !== 'string') return Promise.reject(refusal('INVALID_ARGUMENT', 'scheme is a string'));
        const read = choice == null ? null : choiceOf(choice);
        if (read === undefined)
            return Promise.reject(
                refusal('INVALID_ARGUMENT', `${JSON.stringify(choice)} is not { mod: id } or { system: true }`)
            );
        const run = queue.then(async () => {
            const name = scheme.toLowerCase();
            const found = listsOf(await handlers(), chosen).find((each) => each.scheme === name);
            if (!found) throw refusal('SCHEME', `no mod opens ${scheme}`);
            if (read?.mod !== undefined && !found.mods.some((each) => each.mod.id === read.mod))
                throw refusal('MOD', `${read.mod} opens no address of ${name}`);
            if (read?.system && !found.system) throw refusal('SYSTEM', `nothing opens ${name} outside the app`);
            const next = new Map(chosen);
            if (read === null) next.delete(name);
            else next.set(name, read);
            await records.set(KEPT, Object.fromEntries(next));
            chosen = next;
            return listsOf(await handlers(), chosen).find((each) => each.scheme === name);
        });
        queue = run.catch(() => {});
        return run;
    }

    // MARK: - Private
    // Whether `url` opened: offered to the mods that open it in turn, the first to answer true taking it, then opened
    // outside the app where its scheme is opened there, which a refusal leaves unopened and logs. `activates` false
    // leaves the app where it is.
    async function openFor(url, given, opensFiles) {
        if (typeof url !== 'string') throw refusal('INVALID_ARGUMENT', 'url is a string');
        const address = url.trim();
        if (schemeOf(address) === 'file' && !opensFiles)
            throw refusal('NOT_PERMITTED', `a file opens only for a client that holds ${FILE_HANDLERS}`);
        const { activates = true } = given ?? {};
        if (given != null && (typeof given !== 'object' || Array.isArray(given) || typeof activates !== 'boolean'))
            throw refusal('INVALID_ARGUMENT', 'options is a table { activates }, activates a boolean');
        const options = { activates };
        const route = routeOf(await handlers(), chosen, address);
        for (const handler of route.handlers) if (await offer(handler.mod, address, options)) return true;
        if (!route.system) return false;
        try {
            await deckit.openExternal(address, options);
            return true;
        } catch (error) {
            console.warn(`[urls] ${address} did not open outside the app: ${error.message || error}`);
            return false;
        }
    }

    // Whether the mod `mod` took `address`, reached by its id for the offer: only a plain true takes it. One that is
    // not reached, has no `openURL` or throws passes it on, which is logged.
    async function offer(mod, address, options) {
        try {
            const exports = await dependencies.reach(mod.id);
            try {
                if (typeof exports.openURL !== 'function') throw new Error('its exports for its id have no openURL');
                return (await exports.openURL(address, options)) === true;
            } finally {
                dependencies.release(mod.id).catch((error) => console.error(`[urls] ${mod.id} was not let go`, error));
            }
        } catch (error) {
            console.warn(`[urls] ${mod.name} did not open ${address}: ${error.message || error}`);
            return false;
        }
    }

    function read() {
        return deckit.exports.contributions(INTERFACE);
    }

    // The handlers and the entries left out, as `handlersOf` reads them.
    async function declarations() {
        const read = handlersOf(await declared);
        for (const { mod, problem } of read.refused) warn(`${mod.id}: ${problem}`);
        return read;
    }

    async function handlers() {
        return (await declarations()).handlers;
    }

    function warn(problem) {
        if (warned.has(problem)) return;
        warned.add(problem);
        console.warn(`[urls] ${problem}`);
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    return Object.freeze({ exportsFor });
}

// MARK: - Private
// The choices, as the record holds them: an entry of another shape is left out.
function choicesOf(read) {
    if (!read || typeof read !== 'object' || Array.isArray(read)) return new Map();
    return new Map(
        Object.entries(read)
            .map(([scheme, choice]) => [scheme, choiceOf(choice)])
            .filter(([, choice]) => choice)
    );
}

// `{ mod: id }` or `{ system: true }` as `value` holds it, or undefined for any other shape.
function choiceOf(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const keys = Object.keys(value);
    if (keys.length !== 1) return undefined;
    if (typeof value.mod === 'string') return Object.freeze({ mod: value.mod });
    if (value.system === true) return Object.freeze({ system: true });
    return undefined;
}

module.exports = { router, INTERFACE };
