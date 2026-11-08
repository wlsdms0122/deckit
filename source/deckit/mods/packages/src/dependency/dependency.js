const { requirementOf, takes } = require('../requirement/requirement.js');

// MARK: - Property
// The kind an install is refused with while a dependency is not installed at a version its requirement takes.
const UNMET = 'UNMET_DEPENDENCY';

// MARK: - Initializer
// MARK: - Public
// The dependencies a package file names in its `[dependencies]` table, mod id -> requirement, in the order written:
// `[{ id, requirement, installed, satisfied }]`, `installed` the version of the mod of that id among `found`, as
// deckit.mods lists them, left out for none, and `satisfied` whether the requirement takes it. `read` is what the file
// holds. Refused of kind PACKAGE for a `dependencies` that is no table, and REQUIREMENT for a requirement not written
// in the syntax `requirementOf` reads.
function dependenciesOf(read, found) {
    const table = read.dependencies ?? {};
    if (typeof table !== 'object' || Array.isArray(table))
        throw refusal('PACKAGE', 'package.toml: dependencies is no table');
    return Object.entries(table).map(([id, requirement]) => {
        const range = requirementOf(requirement);
        if (!range) throw refusal('REQUIREMENT', `${id} = ${JSON.stringify(requirement)} is no version requirement`);
        const installed = found.find((mod) => mod.id === id)?.version;
        if (installed === undefined) return { id, requirement, satisfied: false };
        return { id, requirement, installed, satisfied: takes(range, installed) };
    });
}

// The refusal of an install while any of `dependencies` is unmet, naming each, or null for none.
function unmetOf(dependencies) {
    const unmet = dependencies.filter((dependency) => !dependency.satisfied);
    if (!unmet.length) return null;
    const each = unmet.map(({ id, requirement, installed }) =>
        installed === undefined
            ? `${id} ${requirement} is not installed`
            : `${id} ${requirement} is installed as ${installed}`
    );
    return refusal(UNMET, `unmet ${unmet.length === 1 ? 'dependency' : 'dependencies'}: ${each.join('; ')}`);
}

// MARK: - Private
function refusal(kind, message) {
    return Object.assign(new Error(message), { kind });
}

module.exports = { dependenciesOf, unmetOf };
