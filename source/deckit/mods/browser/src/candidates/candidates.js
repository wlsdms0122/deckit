const { placeOf } = require('../address/address.js');
const { folderLabel, isFolder } = require('../tree/tree.js');

// The tabs or the bookmarks of `tree` as the values of a command's param, `{ value, title, hint, keywords }`: an
// item's id as text, `labelOf(item)`, and the folders it is in with its file or site. Ranked for `partial` by the
// title, then the address; every item, in the tree's order, for `''`.
function candidatesOf(tree, labelOf, partial, { matchFields, TIER }) {
    const candidates = tree.items().map((item) => ({
        value: String(item.id),
        title: labelOf(item),
        hint: hintOf(tree, item),
        keywords: [item.url],
    }));
    if (!partial.trim()) return candidates;
    return candidates
        .map((candidate) => ({
            candidate,
            found: matchFields(
                [
                    { text: candidate.title, name: true },
                    { text: candidate.keywords.join(' '), weight: 0.8, cap: TIER.INSIDE },
                ],
                partial
            ),
        }))
        .filter(({ found }) => found)
        .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
        .map(({ candidate }) => candidate);
}

// The item of `tree` a candidate's value names, or null.
function itemOf(tree, value) {
    const node = tree.find(Number(value));
    return node && !isFolder(node) ? node : null;
}

// The folders an item is in, from the outermost, then its file or site.
function hintOf(tree, item) {
    const folders = tree.ancestorsOf(item).reverse();
    return [...folders.map(folderLabel), placeOf(item.url)].join(' / ');
}

module.exports = { candidatesOf, itemOf };
