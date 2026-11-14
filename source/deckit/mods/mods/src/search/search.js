const { TIER, matchFields } = require('deckit-sdk/match');

// The mods `query` finds among `mods` (`{ name, keywords }`) by their names and keywords, best first: every one, as
// given, for nothing typed.
function search(mods, query) {
    if (!query.trim()) return mods;
    return mods
        .map((mod) => ({
            mod,
            found: matchFields(
                [
                    { text: mod.name, name: true },
                    { text: mod.keywords.join(' '), weight: 0.8, cap: TIER.INSIDE },
                ],
                query
            ),
        }))
        .filter(({ found }) => found)
        .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
        .map(({ mod }) => mod);
}

module.exports = { search };
