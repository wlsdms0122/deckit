const { foldersIn, notesIn } = require('../notes-folder/folder.js');
const { shortDate } = require('../date/format.js');
const { parentOf } = require('../notes-folder/path.js');

const SHOWN = 50;

// The notes `searchNotes` finds for `partial`, as the command `open` offers them, or with nothing typed, the notes
// edited last: each by its path, with when it was edited, its folder and where the words were found. Null when
// `signal` aborted, as a newer completion took its place.
async function notesFound(partial, { searchNotes, allNotes, signal }) {
    const words = partial.trim();
    const found = words
        ? await searchNotes(words, { signal }).catch(() => ({ hits: [] }))
        : { hits: notesIn(allNotes).sort((one, other) => other.mtime - one.mtime) };
    if (signal.aborted) return null;
    return found.hits.slice(0, SHOWN).map((note) => ({
        value: note.path,
        title: note.name || 'Untitled',
        hint: [shortDate(note.mtime), parentOf(note.path), (note.snippet || '').slice(0, 70)]
            .filter(Boolean)
            .join(' · '),
    }));
}

// The folders of `allNotes`, as the command `show-folder` offers them, ranked for `partial` by their name and path.
function foldersFound(partial, { allNotes, util: { TIER, matchFields } }) {
    const candidates = foldersIn(allNotes).map((folder) => ({
        value: folder.path,
        title: folder.name,
        hint: parentOf(folder.path),
        keywords: [folder.path],
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

module.exports = { notesFound, foldersFound };
