// The mods and the views of the app under test as a page's reader answers them: each one's first levels by role and
// name, held line by line, so that a part that loses its role or its name fails here.
const path = require('path');
const { pathToFileURL } = require('url');
const { sleep } = require('./devtools.js');
const { asked } = require('./read.js');

const MODEL = pathToFileURL(
    path.join(__dirname, '..', '..', 'deckit', 'deckit-shell', 'shell', 'desktop', 'model', 'reading.js')
).href;
// What a list holds differs from run to run: its items are left out, with what is under them.
const ITEMS = new Set(['listitem', 'option', 'treeitem', 'tab']);
const DEEPEST = 2;

// What each window reads as, three levels deep, without its items, states and counts. A reading may hold more lines
// than these, as what a window shows differs with what was done in it; it holds each of these, in this order.
const MODS = {
    finder: `complementary "Sidebar"
  group "Tabs"
    button "Tabs"
    button "New tab"
    listbox "Tabs"
  group "Favorites"
    button "Favorites"
    list "Favorites"
main
  toolbar
    button "Back"
    button "Forward"
    button "Enclosing folder"
    navigation "Path"
    button "Favorite"
    button "View"
    textbox "Filter this folder"
  tree "Files"
separator "Sidebar"`,
};

// Whether the lines of `text` hold those of `golden`, in its order.
const holds = (text, golden) => {
    const lines = text.split('\n');
    let from = 0;
    return golden.split('\n').every((line) => (from = lines.indexOf(line, from) + 1) > 0);
};

async function run({ check, main, open, show }) {
    const { elementLine } = await import(MODEL);
    const read = await asked(main);
    // A page's reading by role and name alone, and whether it lists any item.
    const reading = async (id) => {
        const { lines = [] } = await read('outline', id);
        const kept = [];
        let under = null;
        for (const { depth, role, name } of lines) {
            if (under !== null && depth > under) continue;
            under = ITEMS.has(role) ? depth : null;
            if (under === null && depth <= DEEPEST) kept.push('  '.repeat(depth) + elementLine({ role, name }));
        }
        return { text: kept.join('\n'), items: lines.filter(({ role }) => ITEMS.has(role)).length };
    };
    for (const [mod, golden] of Object.entries(MODS)) {
        const shown = await open(mod);
        await show(mod);
        await sleep(800);
        const { text, items } = await reading(shown.id);
        console.log(`[views] ${mod}, ${items} items\n${text}`);
        check(`views: the window of ${mod} reads as its parts by role and name`, holds(text, golden), text);
        // The folder a tab of the Finder starts at holds something, and each entry is an item of the tree.
        if (mod === 'finder') check("views: the Finder's entries read as the items of its tree", items > 6, items);
    }
}

module.exports = { run };
