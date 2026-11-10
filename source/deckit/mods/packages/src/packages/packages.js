const { dependenciesOf, unmetOf } = require('../dependency/dependency.js');

// MARK: - Property
const INTERFACE = 'deckit/packages';
// What a client holds to install: what installing through deckit.mods takes.
const MODS = 'deckit.mods';

// MARK: - Initializer
// MARK: - Public
// Installing a mod from a folder once what its package file says it depends on is installed, through deckit.mods.
// `deckit` is the function lifecycle's handle, and `file` the main process module that reads a folder's package file.
function packages(deckit, file) {
    // MARK: - Public
    // The exports for a connection: one that does not hold deckit.mods is refused, kind `NOT_PERMITTED`.
    function exportsFor(connection) {
        if (connection.credential.permissions.includes(MODS)) return Object.freeze({ install });
        const refuse = async () => {
            throw refusal('NOT_PERMITTED', `${connection.mod.name} does not hold ${MODS}`);
        };
        return Object.freeze({ install: refuse });
    }

    // What deckit.mods.install answers for `folder` and `options`. With `dryRun`, which changes nothing, it answers
    // with the dependencies its package file names, as `dependenciesOf` reads them against the mods installed now,
    // met or not. Otherwise it is refused of kind UNMET_DEPENDENCY while one of them is not installed at a version its
    // requirement takes. No dependency is fetched or installed here.
    async function install(folder, options) {
        if (typeof folder !== 'string') throw refusal('INVALID_ARGUMENT', 'install takes (folder, options), a string');
        const dependencies = await dependenciesIn(folder);
        if (options?.dryRun) return { ...(await deckit.mods.install(folder, options)), dependencies };
        const unmet = unmetOf(dependencies);
        if (unmet) throw unmet;
        return deckit.mods.install(folder, options);
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
