const { EVERY, schemeOf, isScheme, isPlace, patternOf, matches } = require('../pattern/pattern.js');

// MARK: - Property
// The schemes opened outside the app, in the order their lists come, and what opens each there.
const SYSTEM = Object.freeze({ http: 'browser', https: 'browser', file: 'file' });

// MARK: - Initializer
// MARK: - Public
// The handlers in what mods declare to deckit/urls, as `contributions` answers it, `[{ mod, entry }]`: each
// `{ mod: { id, name }, scheme, patterns }`, a mod that opens the addresses of `scheme` its patterns take, `*` for
// every scheme, in the mods' order and then the order declared. An entry that cannot be used, a second of one scheme
// from one mod, or one beside a mod's `*`, is told to `warn` and left out.
function handlersOf(contributions, warn) {
    const handlers = [];
    const schemes = new Map(); // mod id -> the schemes it declares
    for (const { mod, entry } of contributions) {
        const read = readOf(entry);
        if (typeof read === 'string') {
            warn(`${mod.id}: an address entry is left out: ${read}`);
            continue;
        }
        const own = schemes.get(mod.id) ?? new Set();
        schemes.set(mod.id, own);
        if (own.has(EVERY) || (read.scheme === EVERY && own.size)) {
            warn(
                `${mod.id}: "${EVERY}" already takes every address, so it stands alone and "${read.scheme}" is left out`
            );
            continue;
        }
        if (own.has(read.scheme)) {
            warn(`${mod.id}: ${read.scheme} is declared already, so a second entry is left out`);
            continue;
        }
        own.add(read.scheme);
        handlers.push({ mod: { id: mod.id, name: mod.name }, ...read });
    }
    return handlers;
}

// Every scheme with a list, as a client of deckit/urls lists them: those opened outside the app, then each one a mod
// declares, then every scheme's, `*`, for an address whose scheme has no list of its own. Each
// `{ scheme, system, chosen, mods }`: `system` what opens it outside the app (`browser`, `file`) or null, `chosen` the
// id of the mod chosen for it or null, and `mods` `[{ mod, patterns }]` its handlers, the chosen first, then by their
// widest pattern, the narrowest first, then by id. `chosen` is a Map, scheme -> mod id.
function listsOf(handlers, chosen) {
    return schemesOf(handlers).map((scheme) => {
        const members = membersOf(handlers, scheme);
        const choice = members.some(({ mod }) => mod.id === chosen.get(scheme)) ? chosen.get(scheme) : null;
        const widest = (handler) => Math.min(...handler.patterns.map(({ specificity }) => specificity));
        return {
            scheme,
            system: SYSTEM[scheme] ?? null,
            chosen: choice,
            mods: ordered(members, widest, choice).map(({ mod, patterns }) => ({
                mod,
                patterns: patterns.map(({ written }) => written),
            })),
        };
    });
}

// Where `address` goes: `{ handlers, system }`, the handlers it is offered to in turn, then what opens it outside the
// app, or null. It goes to its scheme's list, or every scheme's when its scheme has none: to the chosen when one of its
// patterns takes it, then to the others whose patterns take it, the narrowest there first, then by id. An address with
// no scheme, or of one that is no place, goes nowhere, as does a file for a client that may not open files
// (`opensFiles`), whoever would open it.
function routeOf(handlers, chosen, address, { opensFiles }) {
    const scheme = schemeOf(address);
    if (!scheme || !isPlace(scheme)) return { handlers: [], system: null };
    const system = SYSTEM[scheme] ?? null;
    if (system === 'file' && !opensFiles) return { handlers: [], system: null };
    const list = schemesOf(handlers).includes(scheme) ? scheme : EVERY;
    const width = (handler) =>
        Math.max(...handler.patterns.filter((pattern) => matches(pattern, address)).map((each) => each.specificity));
    const taking = membersOf(handlers, list).filter((handler) => width(handler) >= 0);
    return { handlers: ordered(taking, width, chosen.get(list) ?? null), system };
}

// MARK: - Private
// An entry read: `{ scheme, patterns }`, or why it cannot be used.
function readOf(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'an entry is a table';
    const { scheme: written, patterns } = entry;
    if (typeof written !== 'string') return 'it needs a "scheme", text';
    const scheme = written.toLowerCase();
    if (scheme !== EVERY && !isScheme(scheme))
        return `"${written}" is no scheme: one is a letter, then letters, digits, "+", "-" and "."`;
    if (!isPlace(scheme)) return `${scheme} is not a place: nothing opens it`;
    if (patterns === undefined) return { scheme, patterns: [patternOf(scheme === EVERY ? EVERY : `${scheme}:*`)] };
    if (scheme === EVERY) return `"${EVERY}" takes every address, so it has no "patterns"`;
    if (!Array.isArray(patterns) || !patterns.length) return `${scheme}: "patterns" is a list of address patterns`;
    const read = [];
    for (const each of new Set(patterns)) {
        const pattern = patternOf(each);
        if (!pattern || pattern.scheme !== scheme) {
            const one = `"${scheme}:*" or "${scheme}://<host>/<path>*", its * only at the end`;
            return `${scheme}: ${JSON.stringify(each)} is no address pattern of ${scheme}; one is ${one}`;
        }
        read.push(pattern);
    }
    return { scheme, patterns: read };
}

function schemesOf(handlers) {
    const declared = handlers.map(({ scheme }) => scheme);
    const own = declared.filter((scheme) => scheme !== EVERY);
    const every = declared.includes(EVERY) ? [EVERY] : [];
    return [...new Set([...Object.keys(SYSTEM), ...own, ...every])];
}

// The handlers in the list of `scheme`: those of the scheme and of every scheme.
function membersOf(handlers, scheme) {
    return handlers.filter((handler) => handler.scheme === scheme || handler.scheme === EVERY);
}

// `handlers` with the one of the mod `chosen` first, then by `width(handler)`, the specificity it is measured at, the
// highest first, then by id: the mods' order says nothing of who opens what.
function ordered(handlers, width, chosen) {
    const measured = handlers.map((handler) => ({ handler, width: width(handler) }));
    measured.sort(
        (one, other) =>
            (other.handler.mod.id === chosen) - (one.handler.mod.id === chosen) ||
            other.width - one.width ||
            (one.handler.mod.id < other.handler.mod.id ? -1 : one.handler.mod.id > other.handler.mod.id ? 1 : 0)
    );
    return measured.map(({ handler }) => handler);
}

module.exports = { handlersOf, listsOf, routeOf };
