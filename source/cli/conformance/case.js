// A conformance case as the case format fixes it (spec/DECKIT-1): its folder read and held to the format. What the
// format does not take throws a NotACase; a case written for another format throws a TooOld.
const fs = require('fs');
const path = require('path');
const TOML = require('./toml.js');

const FORMAT = 1;
const NAME = /^[a-z][a-z0-9-]*$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const KIND = /^[A-Z][A-Z_]*$/;
const MEMBER = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
const PLACE = /^[a-z0-9._-]+(\/[a-z0-9._-]+)*$/;
const STAGES = ['read', 'launch', 'call'];
const BASES = ['system', 'shell', 'app'];
const FUNCTION = 'case.function';
const ANSWERS = 'case.answers';

class NotACase extends Error {}
class TooOld extends Error {}

const is = {
    string: (value) => typeof value === 'string',
    integer: (value) => Number.isInteger(value),
    boolean: (value) => typeof value === 'boolean',
    array: Array.isArray,
    table: TOML.isTable,
    name: (value) => typeof value === 'string' && NAME.test(value),
    version: (value) => typeof value === 'string' && VERSION.test(value),
    member: (value) => typeof value === 'string' && MEMBER.test(value),
    place: (value) => typeof value === 'string' && PLACE.test(value),
    seconds: (value) => Number.isInteger(value) && value >= 1,
    names: (value) => Array.isArray(value) && value.every(is.name),
    strings: (value) => Array.isArray(value) && value.every(is.string),
};

// Each input and each look, by the keys it writes: `true` where it is required.
const INPUTS = {
    start: {},
    quit: {},
    call: { mod: [is.string, true], member: [is.member, true], args: [is.array, true] },
    key: { chord: [is.string, true] },
    click: { on: [is.place, true] },
    type: { text: [is.string, true] },
    time: { seconds: [is.seconds, true] },
};
const LOOKS = {
    mod: { mod: [is.string, true], part: [is.string, false] },
    mods: {},
    run: { mod: [is.string, true] },
    heard: { function: [is.string, true] },
    shown: { at: [is.place, true] },
};

// The case in `folder`: `{ name, note, host, drive, steps, bundles }`, `bundles` each bundle's folder by its name.
function read(folder) {
    const refuse = (why) => {
        throw new NotACase(`${path.basename(folder)}: ${why}`);
    };
    let written;
    try {
        written = TOML.read(fs.readFileSync(path.join(folder, 'case.toml'), 'utf8'));
    } catch (error) {
        refuse(`case.toml does not read: ${error.message}`);
    }
    if (!is.integer(written.case)) refuse('case is no integer');
    if (written.case !== FORMAT)
        throw new TooOld(`${path.basename(folder)}: this runner is too old for this case (format ${written.case})`);

    keys(
        written,
        { case: is.integer, name: is.name, note: is.string, host: is.table, drive: is.names, step: is.array },
        '',
        refuse
    );
    for (const required of ['name', 'note', 'host', 'step'])
        if (!(required in written)) refuse(`${required} is missing`);
    if (written.name !== path.basename(folder)) refuse(`name is not the folder's name`);

    const host = hostOf(written.host, refuse);
    const drive = written.drive ?? [];
    const steps = written.step.map((step, index) => stepOf(step, index + 1, refuse));
    order(steps, refuse);
    functions(steps, refuse);

    const mods = path.join(folder, 'mods');
    const laid = fs.existsSync(mods)
        ? fs.readdirSync(mods, { withFileTypes: true }).filter((entry) => !entry.name.startsWith('.'))
        : [];
    for (const entry of laid) {
        if (!entry.isDirectory()) refuse(`mods/${entry.name} is no bundle's folder`);
        if (!NAME.test(entry.name)) refuse(`mods/${entry.name} is no bundle-name`);
    }
    const bundles = Object.fromEntries(laid.map(({ name }) => [name, path.join(mods, name)]));
    const named = new Set([...host.ship, ...host.sources, ...drive]);
    for (const name of named) if (!(name in bundles)) refuse(`${name} names no bundle in mods/`);
    for (const name of Object.keys(bundles)) if (!named.has(name)) refuse(`mods/${name} is named by no key`);
    for (const name of drive) if (entryOf(bundles[name], refuse)) refuse(`${name} is driven and holds its main`);

    return { name: written.name, note: written.note, host, drive, steps, bundles };
}

function hostOf(host, refuse) {
    keys(
        host,
        {
            base: (value) => BASES.includes(value),
            api: is.version,
            fields: is.strings,
            permissions: is.array,
            ship: is.names,
            system: is.names,
            sources: is.names,
        },
        'host.',
        refuse
    );
    if (!('base' in host)) refuse('host.base is missing');
    if ((host.base === 'system') !== 'api' in host) refuse('host.api is written with base "system", and only there');
    const permissions = host.permissions ?? [];
    for (const [index, permission] of permissions.entries()) {
        if (!is.table(permission)) refuse(`host.permissions[${index}] is no table`);
        const where = `host.permissions[${index}].`;
        keys(permission, { id: is.string, name: is.string, means: is.string, privileged: is.boolean }, where, refuse);
        for (const required of ['id', 'name', 'means'])
            if (!(required in permission)) refuse(`${where}${required} is missing`);
    }
    const ship = host.ship ?? [];
    const system = host.system ?? [];
    for (const name of system) if (!ship.includes(name)) refuse(`host.system names ${name}, which host.ship does not`);
    return {
        base: host.base,
        api: host.api ?? null,
        fields: host.fields ?? [],
        permissions,
        ship,
        system,
        sources: host.sources ?? [],
    };
}

function stepOf(step, number, refuse) {
    const at = `step ${number}`;
    if (!is.table(step)) refuse(`${at} is no table`);
    if ('input' in step === 'look' in step) refuse(`${at} writes neither or both of input and look`);
    const kind = 'input' in step ? 'input' : 'look';
    const shapes = kind === 'input' ? INPUTS : LOOKS;
    const shape = shapes[step[kind]];
    if (!shape) refuse(`${at}: ${kind} ${JSON.stringify(step[kind])} is none the format has`);
    const checks = Object.fromEntries(Object.entries(shape).map(([key, [check]]) => [key, check]));
    keys(step, { [kind]: is.string, ...checks, expect: is.table }, `${at}: `, refuse);
    for (const [key, [, required]] of Object.entries(shape))
        if (required && !(key in step)) refuse(`${at}: ${key} is missing`);
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
        if ('answers' in expect && kind === 'input' && step.input !== 'call')
            refuse(`${at}: ${step.input} answers nothing, so expect writes no answers`);
    }
    return { number, ...step, kind, what: step[kind], expect };
}

// `start` first, again only after a `quit`, and nothing after a start that is refused.
function order(steps, refuse) {
    let up = false;
    for (const [index, step] of steps.entries()) {
        if (index === 0 && step.what !== 'start') refuse('step 1 is no start');
        if (step.kind !== 'input') continue;
        if (step.what === 'start') {
            if (up) refuse(`step ${step.number} starts the app before a quit`);
            up = true;
            if (step.expect?.refuses && index !== steps.length - 1)
                refuse(`step ${step.number}'s start is refused, and steps follow it`);
        }
        if (step.what === 'quit') up = false;
    }
}

// The functions the calls hand, each name once in the case.
function functions(steps, refuse) {
    const names = new Set();
    const walk = (value) => {
        if (is.array(value)) return value.forEach(walk);
        if (!is.table(value)) return;
        const keys = Object.keys(value);
        if (keys.includes(FUNCTION) && keys.every((key) => key === FUNCTION || key === ANSWERS)) {
            if (!is.string(value[FUNCTION])) refuse(`${FUNCTION} is no string`);
            if (names.has(value[FUNCTION])) refuse(`two functions are named ${value[FUNCTION]}`);
            names.add(value[FUNCTION]);
            return;
        }
        Object.values(value).forEach(walk);
    };
    for (const step of steps) if (step.what === 'call' && step.kind === 'input') walk(step.args);
}

// Whether the bundle holds the file its manifest's main names.
function entryOf(bundle, refuse) {
    let manifest;
    try {
        manifest = TOML.read(fs.readFileSync(path.join(bundle, 'manifest.toml'), 'utf8'));
    } catch (error) {
        refuse(`${path.basename(bundle)} is driven and its manifest does not read: ${error.message}`);
    }
    if (!is.string(manifest.main)) refuse(`${path.basename(bundle)} is driven and its main is no string`);
    return fs.existsSync(path.join(bundle, manifest.main));
}

// Refuses a key of `table` that `checks` does not have, or a value its check does not take.
function keys(table, checks, where, refuse) {
    for (const [key, value] of Object.entries(table)) {
        if (!(key in checks)) refuse(`${where}${key} is no key the format has there`);
        if (!checks[key](value)) refuse(`${where}${key} takes no ${JSON.stringify(value)}`);
    }
}

module.exports = { read, NotACase, TooOld, FUNCTION, ANSWERS };
