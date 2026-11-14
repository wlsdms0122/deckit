// MARK: - Property
// One comparator: an operator, none for caret, and a version of one to three whole numbers.
const COMPARATOR = /^(\^|~|=|>=|<)?\s*(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/;

// MARK: - Initializer
// MARK: - Public
// The versions a requirement takes, as written in package.toml: comparators separated by commas, each of `^`, bare
// the same, `~`, `=`, `>=` or `<` and a version of one to three parts, all of which a version meets. Every comparator
// of these is a range, so the requirement is one too: `{ written, from, below }`, `from` the least version it takes
// and `below` the least past it, null for none, each `[major, minor, patch]`. Null for what is not written so.
function requirementOf(written) {
    if (typeof written !== 'string') return null;
    let from = [0, 0, 0];
    let below = null;
    for (const part of written.split(',')) {
        const match = COMPARATOR.exec(part.trim());
        if (!match) return null;
        const [, operator = '^', ...numbers] = match;
        const parts = numbers.filter((each) => each !== undefined).map(Number);
        if (!parts.every(Number.isSafeInteger)) return null;
        const range = rangeOf(operator, parts);
        if (compare(range.from, from) > 0) from = range.from;
        if (range.below && (!below || compare(range.below, below) < 0)) below = range.below;
    }
    return { written, from, below };
}

// Whether `requirement` takes `version`, written "MAJOR.MINOR.PATCH".
function takes(requirement, version) {
    const read = version.split('.').map(Number);
    return compare(read, requirement.from) >= 0 && (!requirement.below || compare(read, requirement.below) < 0);
}

// MARK: - Private
// The range one comparator takes. Caret leaves the leftmost part that is not zero as it is, or the last part written;
// tilde the minor where it is written, the major where not; `=` every part written.
function rangeOf(operator, parts) {
    const [major, minor = 0, patch = 0] = parts;
    const from = [major, minor, patch];
    if (operator === '>=') return { from, below: null };
    if (operator === '<') return { from: [0, 0, 0], below: from };
    const kept = { '^': major > 0 ? 1 : minor > 0 ? 2 : 3, '~': 2, '=': 3 }[operator];
    return { from, below: next(from, Math.min(kept, parts.length)) };
}

// The least version past every one whose first `count` parts are those of `version`.
function next(version, count) {
    return version.map((part, index) => (index < count - 1 ? part : index === count - 1 ? part + 1 : 0));
}

function compare(one, other) {
    for (let index = 0; index < 3; index++) if (one[index] !== other[index]) return one[index] - other[index];
    return 0;
}

module.exports = { requirementOf, takes };
