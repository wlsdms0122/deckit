const { handlersOf, listsOf, routeOf } = require('../handler/handler.js');
const { reacher } = require('../reach/reach.js');

// MARK: - Property
const INTERFACE = 'deckit/urls';
// What a client holds to list the schemes and choose the mod for one.
const SYSTEM_SERVICES = 'deckit.system-services';
// What a client holds to have a file opened.
const FILE_HANDLERS = 'system.file-handlers';
// The record of the choices: scheme -> `{ mod: id }` or `{ system: true }`.
const KEPT = 'chosen';
// How long a mod has to answer whether it opened an address, in milliseconds, once its exports for its id stand: one
// that has not by then passes it on, so one stuck mod does not hold every address.
const ANSWER_WITHIN = 3000;

// MARK: - Initializer
// MARK: - Public
// The addresses mods declare to deckit/urls, read from what is declared on each ask: an address opened is offered to
// the mods that open it in turn, each reached by its id, and opened outside the app when none takes it. The choices
// are kept in the mod's records. `deckit` is the function lifecycle's handle.
function router(deckit, { within, answerWithin = ANSWER_WITHIN } = {}) {
    // MARK: - Property
    const records = deckit.storage.records;
    const reached = reacher(deckit.dependencies, { within });
    const warned = new Set(); // what was told about a declaration, told once
    let chosen = choicesOf(records.get(KEPT, {}));
    let queue = Promise.resolve(); // the choice under way, which the next waits for

    // MARK: - Public
    // The exports for a connection: any client opens an address, a file only one that holds system.file-handlers, and
    // one that does not hold deckit.system-services is refused the rest, kind `REFUSED`.
    function exportsFor(connection) {
        const { permissions } = connection.credential;
        const opensFiles = permissions.includes(FILE_HANDLERS);
        const open = (url, options) => openFor(url, options, opensFiles);
        if (permissions.includes(SYSTEM_SERVICES)) return Object.freeze({ open, list, choose });
        const refuse = async () => {
            throw refusal('REFUSED', `${connection.mod.name} does not hold ${SYSTEM_SERVICES}`);
        };
        return Object.freeze({ open, list: refuse, choose: refuse });
    }

    // Every scheme with a list, as `listsOf` answers them.
    async function list() {
        return listsOf(await handlers(), chosen);
    }

    // The choice for `scheme`, `{ mod: id }`, `{ system: true }` or none for null: answers the scheme as `list` does.
    function choose(scheme, choice) {
        const run = queue.then(async () => {
            const name = typeof scheme === 'string' ? scheme.toLowerCase() : '';
            const found = listsOf(await handlers(), chosen).find((each) => each.scheme === name);
            if (!found) throw refusal('SCHEME', `no mod opens ${scheme}`);
            const read = choice == null ? null : choiceOf(choice);
            if (read === undefined)
                throw refusal('CHOICE', `${JSON.stringify(choice)} is not { mod: id }, { system: true } or null`);
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
    // outside the app where its scheme is opened there. `activates` false leaves the app where it is.
    async function openFor(url, { activates = true } = {}, opensFiles) {
        const address = String(url).trim();
        const options = { activates: activates !== false };
        const route = routeOf(await handlers(), chosen, address, { opensFiles });
        for (const handler of route.handlers) if (await offer(handler.mod, address, options)) return true;
        if (!route.system) return false;
        return (await deckit.openExternal(address, options)) === true;
    }

    // Whether the mod `mod` took `address`: only a plain true takes it. One that does not launch, has no `openURL`,
    // throws or does not answer in time passes it on, which is logged.
    async function offer(mod, address, options) {
        try {
            return await reached.using(mod.id, async (exports) => {
                if (typeof exports.openURL !== 'function') throw new Error('its exports for its id have no openURL');
                return (await bounded(exports.openURL(address, options), answerWithin)) === true;
            });
        } catch (error) {
            console.warn(`[urls] ${mod.name} did not open ${address}: ${error.message || error}`);
            return false;
        }
    }

    async function handlers() {
        return handlersOf(await deckit.exports.contributions(INTERFACE), warn);
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

// What `answer` settles to, or a rejection once `ms` pass first.
function bounded(answer, ms) {
    let timer;
    const late = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`it did not answer within ${ms / 1000} seconds`)), ms);
    });
    return Promise.race([answer, late]).finally(() => clearTimeout(timer));
}

module.exports = { router, INTERFACE };
