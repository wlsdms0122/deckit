const { dependenciesOf, unmetOf } = require('../dependency/dependency.js');

// MARK: - Property
const INTERFACE = 'deckit/packages';
// What a client holds to plan and install: what installing through deckit.mods takes.
const MODS = 'deckit.mods';

// MARK: - Initializer
// MARK: - Public
// Installing a mod from a folder once what its package file says it depends on is installed, through deckit.mods.
// `deckit` is the function lifecycle's handle, and `file` the main process module that reads a folder's package file.
function packages(deckit, file) {
    // MARK: - Public
    // The exports for a connection: one that does not hold deckit.mods is refused both, kind `NOT_PERMITTED`.
    function exportsFor(connection) {
        if (connection.credential.permissions.includes(MODS)) return Object.freeze({ plan, install });
        const refuse = async () => {
            throw refusal('NOT_PERMITTED', `${connection.mod.name} does not hold ${MODS}`);
        };
        return Object.freeze({ plan: refuse, install: refuse });
    }

    // What deckit.mods.plan answers for `folder`, with the dependencies its package file names, as `dependenciesOf`
    // reads them against the mods installed now.
    async function plan(folder) {
        const planned = await deckit.mods.plan(folder);
        return { ...planned, dependencies: await dependenciesIn(folder) };
    }

    // What deckit.mods.install answers for `folder`, refused of kind UNMET_DEPENDENCY while one of its dependencies is
    // not installed at a version its requirement takes. No dependency is fetched or installed here.
    async function install(folder) {
        if (typeof folder !== 'string') throw refusal('INVALID_ARGUMENT', 'install takes (folder), a string');
        const unmet = unmetOf(await dependenciesIn(folder));
        if (unmet) throw unmet;
        return deckit.mods.install(folder);
    }

    // MARK: - Private
    async function dependenciesIn(folder) {
        const [read, listed] = await Promise.all([file.read(folder), deckit.mods.list()]);
        return dependenciesOf(read, listed.found);
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    return Object.freeze({ exportsFor });
}

module.exports = { packages, INTERFACE };
