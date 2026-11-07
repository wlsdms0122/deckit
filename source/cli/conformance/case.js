// A conformance case as the case format fixes it (spec/DECKIT-1): its folder read and held to the format. What the
// format does not take throws a NotACase; a case written for a later format than FORMAT throws a TooOld.
const fs = require('fs');
const path = require('path');
const TOML = require('./toml.js');

// The newest case format this runner knows. It reads a case of any format from 1 up to it.
const FORMAT = 1;
const NAME = /^[a-z][a-z0-9-]*$/;
const BUNDLE = /^\.?[a-z][a-z0-9-]*$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const KIND = /^[A-Z][A-Z_]*$/;
const STAGES = ['read', 'launch', 'call'];
const BASES = ['system'];

class NotACase extends Error {}
class TooOld extends Error {}

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
    strings: (value) => Array.isArray(value) && value.every(is.string),
};

// Each input and each look, by the keys it writes: `true` where it is required.
const INPUTS = {
    start: {},
    quit: {},
};
const LOOKS = {
    mod: { mod: [is.string, true], part: [is.string, false] },
    mods: {},
};

// The case in `folder`: `{ name, note, host, steps, bundles }`, `bundles` each bundle's folder by its name.
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
    if (!is.integer(written.case) || written.case < 1) refuse('case is no integer of at least 1');
    if (written.case > FORMAT)
        throw new TooOld(`${path.basename(folder)}: this runner is too old for this case (format ${written.case})`);

    keys(
        written,
        { case: is.integer, name: is.name, note: is.string, host: is.table, step: is.array },
        '',
        refuse
    );
    for (const required of ['name', 'note', 'host', 'step'])
        if (!(required in written)) refuse(`${required} is missing`);
    if (written.name !== path.basename(folder)) refuse(`name is not the folder's name`);

    const host = hostOf(written.host, refuse);
    const steps = written.step.map((step, index) => stepOf(step, index + 1, refuse));
    order(steps, refuse);

    const mods = path.join(folder, 'mods');
    const laid = fs.statSync(mods, { throwIfNoEntry: false })?.isDirectory()
        ? fs.readdirSync(mods, { withFileTypes: true }).filter((entry) => entry.isDirectory())
        : [];
    for (const entry of laid) if (!BUNDLE.test(entry.name)) refuse(`mods/${entry.name} is no bundle-name`);
    const bundles = Object.fromEntries(laid.map(({ name }) => [name, path.join(mods, name)]));
    const named = new Set([...host.ship, ...host.sources]);
    for (const name of named) if (!(name in bundles)) refuse(`${name} names no bundle in mods/`);
    for (const name of Object.keys(bundles)) if (!named.has(name)) refuse(`mods/${name} is named by no key`);

    return { name: written.name, note: written.note, host, steps, bundles };
}

function hostOf(host, refuse) {
    keys(
        host,
        {
            base: (value) => BASES.includes(value),
            api: is.version,
            fields: is.strings,
            permissions: is.array,
            ship: is.bundles,
            system: is.bundles,
            sources: is.bundles,
        },
        'host.',
        refuse
    );
    for (const required of ['base', 'api']) if (!(required in host)) refuse(`host.${required} is missing`);
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
        api: host.api,
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
        if ('answers' in expect && kind === 'input')
            refuse(`${at}: ${step.input} answers nothing, so expect writes no answers`);
    }
    return { number, ...step, kind, what: step[kind], expect };
}

// `start` first, again only after a `quit`, looks only while the app is started, and nothing after a start that is
// refused.
function order(steps, refuse) {
    let up = false;
    for (const [index, step] of steps.entries()) {
        if (index === 0 && step.what !== 'start') refuse('step 1 is no start');
        if (step.kind !== 'input') {
            if (!up) refuse(`step ${step.number} looks after a quit`);
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
