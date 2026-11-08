const { requirementOf, takes } = require('../requirement/requirement.js');

// MARK: - Property
// The kind an install is refused with while a dependency is not installed at a version its requirement takes.
const UNMET = 'UNMET_DEPENDENCY';

// MARK: - Initializer
// MARK: - Public
// The dependencies the `[dependencies]` table of package.toml names, mod id -> requirement, in the order written:
// `[{ id, requirement, installed, satisfied }]`, `installed` the version of the mod of that id among `found`, as
// deckit.mods lists them, or null for none, and `satisfied` whether the requirement takes it. Refused of kind
// REQUIREMENT for a requirement not written in the syntax `requirementOf` reads.
function dependenciesOf(table, found) {
    return Object.entries(table ?? {}).map(([id, requirement]) => {
        const read = requirementOf(requirement);
        if (!read) throw refusal('REQUIREMENT', `${id} = ${JSON.stringify(requirement)} is no version requirement`);
        const installed = found.find((mod) => mod.id === id)?.version ?? null;
        return { id, requirement, installed, satisfied: installed !== null && takes(read, installed) };
    });
}

// The refusal of an install while any of `dependencies` is unmet, naming each, or null for none.
function unmetOf(dependencies) {
    const unmet = dependencies.filter((dependency) => !dependency.satisfied);
    if (!unmet.length) return null;
    const each = unmet.map(({ id, requirement, installed }) =>
        installed === null
            ? `${id} ${requirement} is not installed`
            : `${id} ${requirement} is installed as ${installed}`
    );
    return refusal(UNMET, `unmet ${unmet.length === 1 ? 'dependency' : 'dependencies'}: ${each.join('; ')}`);
}

// MARK: - Private
function refusal(kind, message) {
    return Object.assign(new Error(message), { kind });
}

module.exports = { dependenciesOf, unmetOf, UNMET };
