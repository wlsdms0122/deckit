const { nameOf, folderOf } = require('../path/path.js');

const SHOWN = 50;

// The files of `workspace` that match `partial`, as the command `open` offers them: each by its absolute path, under
// its name, with the folder it is in. Null when a newer ranking by `ranker` cancelled this one.
async function filesFound(workspace, partial, { listFiles, ranker }) {
    if (!workspace?.root) return [];
    const listing = await listFiles(workspace);
    const ranked = await ranker.rank(listing?.files || [], partial, { limit: SHOWN });
    if (!ranked) return null;
    return ranked.map((relative) => ({
        value: workspace.root + '/' + relative,
        title: nameOf(relative),
        hint: folderOf(relative) || nameOf(workspace.root),
    }));
}

module.exports = { filesFound };
