const { notesIn } = require('../notes-folder/folder.js');
const { shortDate } = require('../date/format.js');
const { parentOf } = require('../notes-folder/path.js');

const SHOWN = 50;

// The notes `searchNotes` finds for `partial`, as the switcher offers them, or with nothing typed, the notes edited
// last: each by its path, with when it was edited, its folder and where the words were found. Null when `signal`
// aborted, as a newer search took its place.
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

module.exports = { notesFound };
