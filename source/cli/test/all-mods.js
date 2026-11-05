// The Mods mod's search (mods/mods/src/search): every mod for nothing typed, as listed, and otherwise those found by
// name or keyword, a name before a keyword, with deckit's matcher (deckit-shell/deckit/match). Exits 1 with a line for
// each check that failed.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { search } = require(
        path.join(__dirname, '..', '..', 'deckit', 'mods', 'mods', 'src', 'search', 'search.js')
    );
    const MATCH = await import(url('deckit-shell', 'deckit', 'match', 'match.js'));
    const util = { matchFields: MATCH.matchFields, TIER: MATCH.TIER };
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const mods = [
        { id: 'editor', name: 'Editor', keywords: ['code', 'text'] },
        { id: 'note', name: 'Note', keywords: ['memo', 'text'] },
        { id: 'settings', name: 'Settings', keywords: ['설정', 'preferences'] },
        { id: 'texts', name: 'Texts', keywords: [] },
    ];
    const ids = (found) => found.map(({ id }) => id).join();

    const all = ids(search(mods, '  ', util));
    check('nothing typed lists every mod, as listed', all === 'editor,note,settings,texts', all);
    const named = ids(search(mods, 'set', util));
    check('a mod is found by its name', named === 'settings', named);
    const korean = ids(search(mods, '설정', util));
    check('a mod is found by a keyword', korean === 'settings', korean);
    const text = ids(search(mods, 'text', util));
    check('a name found ranks before a keyword found', text.startsWith('texts,') && text.split(',').length === 3, text);
    const none = ids(search(mods, 'zzz', util));
    check('what matches nothing finds nothing', none === '', none);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} all mods checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
