// The mods and the views of the app under test as a page's reader answers them: each one's first levels by role and
// name, held line by line, so that a part that loses its role or its name fails here.
const path = require('path');
const { pathToFileURL } = require('url');
const { sleep, until } = require('./devtools.js');
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
    note: `complementary "Sidebar"
  group "All Notes"
    button "All Notes"
    tree "Notes"
  button "New Folder"
main
  toolbar
    button "Back"
    button "Forward"
    navigation "Path"
    button "New note"
    textbox "Search all notes"
  list "Folders"
  list "Notes"
separator "Sidebar"`,
    calendar: `complementary "Sidebar"
  group "Calendars"
    button "Calendars"
    button "Add Account…"
main
separator "Sidebar"`,
    bot: `complementary "Sidebar"
  group "Forge"
    button "Forge"
    listbox "Forge"
  group "LLMemory"
    button "LLMemory"
    listbox "LLMemory"
main
  toolbar
    combobox "Forge session"
separator "Sidebar"`,
};
const CENTER = 'region "Notifications"';
// The status bar's band, read left to right as it stands: the Notifications item with its count and its attention,
// then the clock at the right end, named with the time it says.
const BAND = `toolbar "Status Bar"
  button "Notifications*"
  button "Clock, *"`;
// Mods: the mods a named list, each an item.
const LAUNCHER = `toolbar "Mods"
  textbox "Search"
list "Mods"`;
// The views read where the checks of another area have them stand, whole, their items too: `*` is any text.
const STANDING = {
    seats: `group "Seats"
  button "*"
  button "First"
  button "Second"`,
    toast: `alert "Toasted, Stands until it is answered."
  img "Status Item"
  button "Later"
  button "Close"`,
    center: `region "Notifications"
  button "Clear All"
  listbox
    option "Toasted, Stands until it is answered."
      img "Status Item"
      button "Later"
      button "Remove"`,
};

// Whether the lines of `text` hold those of `golden`, in its order: a `*` in a golden line is any text there.
const holds = (text, golden) => {
    const lines = text.split('\n');
    const plain = (part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let from = 0;
    return golden.split('\n').every((line) => {
        const shape = new RegExp(`^${line.split('*').map(plain).join('.*')}$`);
        const at = lines.findIndex((each, index) => index >= from && shape.test(each));
        from = at + 1;
        return at >= 0;
    });
};

// How a run reads a page by role and name alone: `reading(id, { deepest, items })` answers `{ text, items }`, the
// lines `deepest` levels deep, with what a list holds only where `items` says so, and how many items it lists.
async function reader(main) {
    const { elementLine } = await import(MODEL);
    const read = await asked(main);
    return async (id, { deepest = DEEPEST, items = false } = {}) => {
        const { lines = [] } = await read('outline', id);
        const kept = [];
        let under = null;
        for (const { depth, role, name } of lines) {
            if (under !== null && depth > under) continue;
            under = !items && ITEMS.has(role) ? depth : null;
            if (under === null && depth <= deepest) kept.push('  '.repeat(depth) + elementLine({ role, name }));
        }
        return { text: kept.join('\n'), items: lines.filter(({ role }) => ITEMS.has(role)).length };
    };
}

// The windows of the mod `mod` the host window lays, on any seat's screen.
const laidOf = async (desktopLaid, mod) =>
    ((await desktopLaid())?.pages ?? []).filter(
        ({ opener, name }) => opener?.startsWith(`deckit://${mod}.mod`) && /^deckit-window-/.test(name)
    );

async function run({ check, main, open, show, desktopLaid, pressIn }) {
    const reading = await reader(main);
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
    const launcher = await open('mods');
    await show('mods');
    await sleep(800);
    const listed = await reading(launcher.id);
    console.log(`[views] mods, ${listed.items} items\n${(await reading(launcher.id, { items: true })).text}`);
    check(
        'views: the window of mods reads as a named list of the mods, each an item',
        holds(listed.text, LAUNCHER) && listed.items > 6,
        listed.text
    );
    const bell = '.status-bar-item[data-item="notifications"]';
    const [bar] = await laidOf(desktopLaid, 'status-bar');
    const band = bar ? (await reading(bar.id)).text : '';
    console.log(`[views] the status bar\n${band}`);
    check(
        'views: the status bar reads as its items left to right, the clock by the time it says',
        holds(band, BAND),
        band
    );
    await pressIn(bar, bell);
    const center = await until(async () => (await laidOf(desktopLaid, 'notifications'))[0], 4000);
    await sleep(500);
    const { text } = center ? await reading(center.id) : { text: '' };
    console.log(`[views] the notification center\n${text}`);
    check('views: the notification center reads as a region by its name', holds(text, CENTER), text);
    if (center) await pressIn(bar, bell);
}

// A view of the mod `mod` as it stands now, on any seat's screen, read whole: `check` is told whether one of the
// mod's windows reads as STANDING has the view `named`, under the name of the area that has it stand.
async function standing({ check, main, desktopLaid, area }, mod, named) {
    const reading = await reader(main);
    const texts = [];
    for (const { id } of await laidOf(desktopLaid, mod))
        texts.push((await reading(id, { deepest: 4, items: true })).text);
    console.log(`[views] ${named} as it stands\n${texts.join('\n--\n')}`);
    check(
        `${area}: the ${named} view of ${mod} reads as its parts by role and name`,
        texts.some((text) => holds(text, STANDING[named])),
        texts.join('\n--\n')
    );
}

module.exports = { run, standing };
