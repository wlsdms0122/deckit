// A conformance case as the case format fixes it (spec/DECKIT-1): its folder read and held to the format. What the
// format does not take throws a NotACase; a case written for a later format than FORMAT throws a TooOld.
const fs = require('fs');
const path = require('path');
const TOML = require('./toml.js');

// The newest case format this runner knows. It reads a case of any format from 1 up to it.
const FORMAT = 18;
const NAME = /^[a-z][a-z0-9-]*$/;
const BUNDLE = /^\.?[a-z][a-z0-9-]*$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const KIND = /^[A-Z][A-Z_]*$/;
const MEMBER = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/;
// The name of a standard interface, as the bundle names an interface.
const STANDARD = /^deckit\/[a-z][a-z0-9-]*$/;
// A site's address, as a call writes it: a site's name, then a path on it, if any.
const SITE_ADDRESS = /^([a-z][a-z0-9-]*)(\/(?!\/)[\x21-\x7e]*)?$/;
// A file of a bundle, as a show writes it: a bundle's name, then a path in it.
const BUNDLE_FILE = /^(\.?[a-z][a-z0-9-]*)\/(?!\/)[\x21-\x7e]+$/;
// A path a site answers, as its file writes one, and the path a site redirects to: `/`, and no `//` to start it.
const PATH = /^\/(?!\/)[\x21-\x7e]*$/;
// A header's name, a token as HTTP writes it, and its value, which holds no line break and no NUL.
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const LOWER_TOKEN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/;
const VALUE = /^[^\0\r\n]*$/;
// The headers a site's answer has that the runner writes itself, which a site's file does not.
const WRITTEN = /^(location|content-length|connection|transfer-encoding)$/i;
const STAGES = ['read', 'launch', 'call'];
const BASES = ['system', 'web', 'shell'];
// The format that added a base, where it is not 1.
const BASES_ADDED = { shell: 6, web: 8 };
// The handles a call's member is read from, by name: `deckit`, each a framework hands, and the shell's.
const HANDLES = ['deckit', 'web', 'shell'];
// The format that added a handle, where it is not the one that added the key.
const HANDLES_ADDED = { shell: 15 };

class NotACase extends Error {}
class TooOld extends Error {}

// What a person's hand does on a window, format 17, and the edges a drag of one takes.
const ACTIONS = ['press', 'close', 'minimize', 'zoom', 'move', 'resize', 'doubleClick'];
const EDGES = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

// A scheme as an address writes it, in lower case: format 12, a key of host.apps.
const SCHEME = /^[a-z][a-z0-9+.-]*$/;
const is = {
    string: (value) => typeof value === 'string',
    integer: (value) => Number.isInteger(value),
    boolean: (value) => typeof value === 'boolean',
    array: Array.isArray,
    table: TOML.isTable,
    name: (value) => typeof value === 'string' && NAME.test(value),
    version: (value) =>
        typeof value === 'string' &&
        VERSION.test(value) &&
        value.split('.').every((part) => BigInt(part) <= BigInt(Number.MAX_SAFE_INTEGER)),
    bundles: (value) => Array.isArray(value) && value.every((one) => typeof one === 'string' && BUNDLE.test(one)),
    member: (value) => typeof value === 'string' && MEMBER.test(value),
    strings: (value) => Array.isArray(value) && value.every(is.string),
    standards: (value) =>
        Array.isArray(value) &&
        value.every((one) => typeof one === 'string' && STANDARD.test(one)) &&
        new Set(value).size === value.length,
};

// Each input and each look, by the keys it writes: `true` where it is required.
const INPUTS = {
    start: {},
    quit: {},
    call: {
        mod: [is.string, true],
        member: [is.member, true],
        handle: [(value) => HANDLES.includes(value), false],
        args: [is.array, false],
        folders: [is.bundles, false],
        part: [is.string, false],
        of: [(value) => is.integer(value) && value >= 1, false],
        listener: [is.boolean, false],
        handed: [is.boolean, false],
        delegated: [(value) => is.integer(value) && value >= 1, false],
        answered: [(value) => is.integer(value) && value >= 1, false],
        sites: [
            (value) => Array.isArray(value) && value.every((one) => is.string(one) && SITE_ADDRESS.test(one)),
            false,
        ],
        origins: [
            (value) => Array.isArray(value) && value.every(is.name) && new Set(value).size === value.length,
            false,
        ],
    },
    press: { notification: [(value) => is.integer(value) && value >= 1, true] },
    show: {
        mod: [is.string, true],
        session: [is.string, true],
        site: [(value) => is.string(value) && SITE_ADDRESS.test(value), false],
        url: [(value) => is.string(value) && !/^https?:/i.test(value), false],
        file: [
            (value) =>
                is.string(value) &&
                BUNDLE_FILE.test(value) &&
                value
                    .split('/')
                    .slice(1)
                    .every((one) => one && one !== '.' && one !== '..'),
            false,
        ],
        apart: [is.boolean, false],
    },
    activate: { mod: [is.string, true], of: [(value) => is.integer(value) && value >= 1, true] },
    key: {
        keystroke: [
            (value) =>
                is.table(value) &&
                is.string(value.code) &&
                value.code !== '' &&
                Object.entries(value).every(
                    ([key, one]) =>
                        key === 'code' || (['meta', 'control', 'alt', 'shift'].includes(key) && is.boolean(one))
                ),
            true,
        ],
    },
    window: {
        mod: [is.string, true],
        name: [is.string, false],
        action: [(value) => ACTIONS.includes(value), true],
        edge: [(value) => EDGES.includes(value), false],
        by: [
            (value) =>
                is.table(value) &&
                Object.keys(value).every((key) => key === 'x' || key === 'y') &&
                Object.values(value).every(is.integer),
            false,
        ],
    },
};
const LOOKS = {
    mod: { mod: [is.string, true], part: [is.string, false] },
    mods: {},
    run: { mod: [is.string, true] },
    opened: {},
    heard: { mod: [is.string, true] },
    shown: {},
    delegated: { mod: [is.string, true], part: [is.string, false] },
    downloaded: {},
    revealed: {},
    windows: {},
    desktop: {},
    requested: {
        headers: [
            (value) =>
                Array.isArray(value) &&
                value.every((one) => is.string(one) && LOWER_TOKEN.test(one)) &&
                new Set(value).size === value.length,
            false,
        ],
    },
};
// The format that added an input or a look, where it is not 1.
const ADDED = {
    run: 2,
    call: 3,
    opened: 3,
    heard: 4,
    press: 7,
    shown: 7,
    requested: 9,
    show: 10,
    delegated: 10,
    activate: 11,
    downloaded: 14,
    revealed: 16,
    window: 17,
    windows: 17,
    key: 18,
    desktop: 18,
};
// The format that added a key of an input or a look, where it is a later one than the step's.
const KEYS_ADDED = {
    of: 4,
    listener: 4,
    handed: 5,
    handle: 8,
    sites: 9,
    headers: 9,
    file: 11,
    origins: 12,
    delegated: 13,
    answered: 14,
};
// The format that added a key of the host, where it is not 1.
const HOST_KEYS_ADDED = { owners: 5, sites: 9, delegate: 10, apps: 12, chosen: 16 };
// The inputs answered with nothing.
const ANSWERLESS = ['start', 'quit', 'press', 'show', 'activate', 'window', 'key'];

// The case in `folder`: `{ name, note, host, steps, bundles, sites }`, `bundles` each bundle's folder by its name,
// and `sites` each site's `{ folder, answers }`: the folder whose files it serves, or null, and what its file writes
// of each path.
function read(folder) {
    const refuse = (why) => {
        throw new NotACase(why);
    };
    let written;
    try {
        written = TOML.read(fs.readFileSync(path.join(folder, 'case.toml'), 'utf8'));
    } catch (error) {
        refuse(`case.toml does not read: ${error.message}`);
    }
    if (!is.integer(written.case) || written.case < 1) refuse('case is no integer of at least 1');
    if (written.case > FORMAT) throw new TooOld(`this runner is too old for this case (format ${written.case})`);

    keys(written, { case: is.integer, name: is.name, note: is.string, host: is.table, step: is.array }, '', refuse);
    for (const required of ['name', 'note', 'host', 'step'])
        if (!(required in written)) refuse(`${required} is missing`);
    if (written.name !== path.basename(folder)) refuse(`name is not the folder's name`);

    const host = hostOf(written.host, written.case, refuse);
    const steps = written.step.map((step, index) => stepOf(step, index + 1, written.case, refuse));
    order(steps, refuse);

    const mods = path.join(folder, 'mods');
    const laid = fs.statSync(mods, { throwIfNoEntry: false })?.isDirectory()
        ? fs.readdirSync(mods, { withFileTypes: true })
        : [];
    for (const entry of laid) if (!BUNDLE.test(entry.name)) refuse(`mods/${entry.name} is no bundle-name`);
    const bundles = Object.fromEntries(laid.map(({ name }) => [name, path.join(mods, name)]));
    const filed = steps.flatMap(({ file }) => (file ? [BUNDLE_FILE.exec(file)[1]] : []));
    const named = new Set([
        ...host.ship,
        ...host.sources,
        ...host.chosen,
        ...steps.flatMap(({ folders = [] }) => folders),
        ...filed,
    ]);
    for (const name of named)
        if ([...host.ship, ...host.sources].filter((one) => one === name).length > 1)
            refuse(`${name} is written twice in host.ship and host.sources`);
    for (const name of named) if (!(name in bundles)) refuse(`${name} names no bundle in mods/`);
    for (const name of Object.keys(bundles)) if (!named.has(name)) refuse(`mods/${name} is named by no key`);

    for (const step of steps)
        for (const address of [...(step.sites ?? []), ...(step.site ? [step.site] : [])]) {
            const [, site] = SITE_ADDRESS.exec(address);
            if (!host.sites.includes(site))
                refuse(`step ${step.number}: sites names ${site}, which host.sites does not`);
        }
    for (const step of steps)
        for (const site of step.origins ?? [])
            if (!host.sites.includes(site))
                refuse(`step ${step.number}: origins names ${site}, which host.sites does not`);
    const sites = sitesOf(path.join(folder, 'sites'), host.sites, refuse);

    return { name: written.name, note: written.note, host, steps, bundles, sites };
}

// Each site `named` in `folder`: its folder `<name>/` and its file `<name>.toml`, either or both; nothing else is
// there.
function sitesOf(folder, named, refuse) {
    const laid = fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()
        ? fs.readdirSync(folder, { withFileTypes: true })
        : [];
    const sites = {};
    for (const entry of laid) {
        const name = entry.isDirectory() ? entry.name : entry.name.replace(/\.toml$/, '');
        const what = entry.isDirectory() ? 'folder' : 'file';
        if (!NAME.test(name) || (what === 'file' && (!entry.isFile() || !entry.name.endsWith('.toml'))))
            refuse(`sites/${entry.name} is no site's folder or file`);
        if (!named.includes(name)) refuse(`sites/${entry.name} is named by no key`);
        sites[name] = sites[name] ?? { folder: null, answers: {} };
        if (what === 'folder') sites[name].folder = path.join(folder, entry.name);
        else sites[name].answers = answersOf(path.join(folder, entry.name), `sites/${entry.name}`, refuse);
    }
    for (const name of named) if (!(name in sites)) refuse(`${name} names no site in sites/`);
    return sites;
}

// What a site's file writes of each path it answers: `{ status, location, headers }`, each a key it may leave out.
function answersOf(file, where, refuse) {
    let written;
    try {
        written = TOML.read(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        refuse(`${where} does not read: ${error.message}`);
    }
    const header = (pair) =>
        Array.isArray(pair) && pair.length === 2 && is.string(pair[0]) && is.string(pair[1]) && TOKEN.test(pair[0]);
    for (const [at, answer] of Object.entries(written)) {
        if (!PATH.test(at)) refuse(`${where}: ${JSON.stringify(at)} is no path`);
        if (!is.table(answer)) refuse(`${where}: ${at} is no table`);
        keys(
            answer,
            {
                status: (value) => is.integer(value) && value >= 200 && value <= 599,
                location: (value) => is.string(value) && PATH.test(value),
                headers: (value) =>
                    Array.isArray(value) &&
                    value.every(header) &&
                    value.every(([name, value]) => VALUE.test(value) && !WRITTEN.test(name)),
            },
            `${where}: ${at}.`,
            refuse
        );
    }
    return written;
}

function hostOf(host, format, refuse) {
    for (const key of Object.keys(host))
        if ((HOST_KEYS_ADDED[key] ?? 1) > format) refuse(`host.${key} is no key format ${format} has`);
    keys(
        host,
        {
            base: (value) => BASES.includes(value) && (BASES_ADDED[value] ?? 1) <= format,
            api: is.version,
            fields: is.strings,
            permissions: is.array,
            ship: is.bundles,
            system: is.bundles,
            sources: is.bundles,
            chosen: is.bundles,
            owners: is.standards,
            sites: (value) => Array.isArray(value) && value.every(is.name),
            delegate: (value) =>
                is.table(value) && Object.keys(value).every((one) => /^[A-Za-z][A-Za-z0-9]*$/.test(one)),
            apps: (value) =>
                is.table(value) &&
                Object.entries(value).every(([scheme, app]) => SCHEME.test(scheme) && is.string(app) && app !== ''),
        },
        'host.',
        refuse
    );
    for (const required of ['base', 'api']) if (!(required in host)) refuse(`host.${required} is missing`);
    const permissions = host.permissions ?? [];
    for (const [index, permission] of permissions.entries()) {
        if (!is.table(permission)) refuse(`host.permissions[${index}] is no table`);
        const where = `host.permissions[${index}].`;
        keys(
            permission,
            { id: is.string, name: is.string, description: is.string, privileged: is.boolean },
            where,
            refuse
        );
        for (const required of ['id', 'name', 'description'])
            if (!(required in permission)) refuse(`${where}${required} is missing`);
    }
    const ship = host.ship ?? [];
    const system = host.system ?? [];
    for (const name of system) if (!ship.includes(name)) refuse(`host.system names ${name}, which host.ship does not`);
    const sites = host.sites ?? [];
    if (new Set(sites).size !== sites.length) refuse('host.sites names a site twice');
    return {
        base: host.base,
        api: host.api,
        fields: host.fields ?? [],
        permissions,
        ship,
        system,
        sources: host.sources ?? [],
        owners: host.owners ?? [],
        sites: host.sites ?? [],
        delegate: host.delegate ?? {},
        apps: host.apps ?? {},
        chosen: host.chosen ?? [],
    };
}

function stepOf(step, number, format, refuse) {
    const at = `step ${number}`;
    if (!is.table(step)) refuse(`${at} is no table`);
    if ('input' in step === 'look' in step) refuse(`${at} writes neither or both of input and look`);
    const kind = 'input' in step ? 'input' : 'look';
    const shapes = kind === 'input' ? INPUTS : LOOKS;
    const shape = shapes[step[kind]];
    if (!shape || (ADDED[step[kind]] ?? 1) > format)
        refuse(`${at}: ${kind} ${JSON.stringify(step[kind])} is none the format has`);
    const checks = Object.fromEntries(Object.entries(shape).map(([key, [check]]) => [key, check]));
    keys(step, { [kind]: is.string, ...checks, expect: is.table }, `${at}: `, refuse);
    for (const [key, [, required]] of Object.entries(shape))
        if (required && !(key in step)) refuse(`${at}: ${key} is missing`);
    for (const key of Object.keys(step))
        if ((KEYS_ADDED[key] ?? 1) > format) refuse(`${at}: ${key} is no key format ${format} has`);
    if ((HANDLES_ADDED[step.handle] ?? 1) > format) refuse(`${at}: handle ${step.handle} is none format ${format} has`);
    const expect = step.expect ?? null;
    if (kind === 'look' && !expect) refuse(`${at}: a look writes expect`);
    if (expect) {
        keys(
            expect,
            {
                answers: () => true,
                refuses: (value) => STAGES.includes(value),
                kind: (value) => is.string(value) && KIND.test(value),
            },
            `${at}: expect.`,
            refuse
        );
        if ('answers' in expect === 'refuses' in expect) refuse(`${at}: expect holds answers, or refuses and kind`);
        if ('refuses' in expect !== 'kind' in expect)
            refuse(`${at}: expect writes kind beside refuses, and only there`);
        if ('answers' in expect && ANSWERLESS.includes(step.input))
            refuse(`${at}: ${step.input} answers nothing, so expect writes no answers`);
    }
    return { number, ...step, kind, what: step[kind], expect };
}

// `start` first, again only after a `quit`, calls, presses, hands and looks only while the app is started, nothing
// after a start that is refused, a call's `of` an earlier call or show of its mod, an activate's an earlier show of
// it, a call's `answered` an earlier call, no `of` beside `handed`, nor `handle` beside either, `delegated` beside none
// of the three, at most one of `site`, `url` and `file`, and a hand's `edge` beside a resize alone and `by` beside a
// move or a resize alone.
function order(steps, refuse) {
    let up = false;
    for (const [index, step] of steps.entries()) {
        if (index === 0 && step.what !== 'start') refuse('step 1 is no start');
        const of = step.of && steps[step.of - 1];
        const ofs = step.what === 'activate' ? ['show'] : ['call', 'show'];
        if (step.of && !(step.of < step.number && ofs.includes(of.what) && of.mod === step.mod))
            refuse(`step ${step.number}: of names no earlier ${ofs.join(' or ')} of ${step.mod}`);
        if (step.answered && !(step.answered < step.number && steps[step.answered - 1].what === 'call'))
            refuse(`step ${step.number}: answered names no earlier call`);
        if (['site', 'url', 'file'].filter((key) => key in step).length > 1)
            refuse(`step ${step.number}: site, url and file are written beside one another`);
        if (step.handed && step.of) refuse(`step ${step.number}: handed is written with no of`);
        if ('handle' in step && (step.of || step.handed))
            refuse(`step ${step.number}: handle is written with neither of nor handed`);
        if ('delegated' in step && ['of', 'handed', 'handle'].some((key) => key in step))
            refuse(`step ${step.number}: delegated is written with none of of, handed and handle`);
        if (step.what === 'window' && (step.action === 'resize') !== 'edge' in step)
            refuse(`step ${step.number}: edge is written beside a resize, and only there`);
        if (step.what === 'window' && 'by' in step && !['move', 'resize'].includes(step.action))
            refuse(`step ${step.number}: by is written beside a move or a resize only`);
        if (step.kind !== 'input' || ['call', 'press', 'show', 'activate', 'window', 'key'].includes(step.what)) {
            if (!up) refuse(`step ${step.number} ${step.kind === 'input' ? step.what + 's' : 'looks'} after a quit`);
            continue;
        }
        if (step.what === 'start') {
            if (up) refuse(`step ${step.number} starts the app before a quit`);
            up = true;
            if (step.expect?.refuses && index !== steps.length - 1)
                refuse(`step ${step.number}'s start is refused, and steps follow it`);
        }
        if (step.what === 'quit') up = false;
    }
}

// Refuses a key of `table` that `checks` does not have, or a value its check does not take.
function keys(table, checks, where, refuse) {
    for (const [key, value] of Object.entries(table)) {
        if (!(key in checks)) refuse(`${where}${key} is no key the format has there`);
        if (!checks[key](value)) refuse(`${where}${key} takes no ${JSON.stringify(value)}`);
    }
}

module.exports = { read, NotACase, TooOld };
