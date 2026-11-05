// The panel's list order (deckit-shell/shell/panel/model/list-order): the mods the person placed first, as placed, the rest
// as deckit lists them, and a drag that moves the ids it names among the places they held. The Dock's items
// (model/dock): those kept, then those running. And where the frame's parts are (model/layout) at a panel's size. Exits 1 with a line for each check that failed. The packages are ES modules,
// so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const LIST_ORDER = await import(url('deckit-shell', 'shell', 'panel', 'model', 'list-order.js'));
    const LAYOUT = await import(url('deckit-shell', 'shell', 'panel', 'model', 'layout.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'panel', 'model', 'dock.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const sorted = LIST_ORDER.sorted(['a', 'b', 'c', 'd'], ['c', 'x', 'a']).join();
    check('those placed come first, as placed, then the rest as listed', sorted === 'c,a,b,d', sorted);
    const arranged = LIST_ORDER.arranged(['a', 'b', 'c', 'd'], ['d', 'b', 'x', 'd']).join();
    check('the ids named move among the places they held, the rest stay put', arranged === 'a,d,c,b', arranged);

    const ids = ['a', 'b', 'c', 'd', 'e'];
    const docked = DOCK.items(ids, { pinned: new Set(['d', 'b']), running: new Set(['b', 'c', 'e']) });
    check(
        'the Dock holds the mods kept, in the list order, then those running that are not kept',
        JSON.stringify(docked) ===
            JSON.stringify([
                { id: 'b', pinned: true, running: true },
                { id: 'd', pinned: true, running: false },
                { id: 'c', pinned: false, running: true },
                { id: 'e', pinned: false, running: true },
            ]),
        docked
    );
    const unkept = DOCK.items(ids, { pinned: new Set(['b']), running: new Set(['c']) }).map(({ id }) => id);
    check('a mod taken out of the Dock that does not run leaves it', unkept.join() === 'b,c', unkept);
    const kept = DOCK.items(ids, { pinned: new Set(['a', 'c']), running: new Set(['c']) }).map(({ id }) => id);
    check('a running mod kept is listed once, where it is kept', kept.join() === 'a,c', kept);

    const slot = { top: 100, bottom: 10 };
    const open = LAYOUT.laidOut({ size: { width: 1000, height: 700 }, width: 300, collapsed: false, slot });
    check(
        'open, the content starts past the card and the handle stands over its edge',
        open.content.x === 316 && open.content.width === 684 && open.handle.x === 314 && open.handle.y === 318,
        open
    );
    check(
        'the slot takes the card below the list, as tall as the panel lets it',
        JSON.stringify(open.sidebar) === JSON.stringify({ x: 9, y: 109, width: 298, height: 572 }),
        open.sidebar
    );
    const narrow = LAYOUT.laidOut({ size: { width: 640, height: 700 }, width: 400, collapsed: false, slot });
    check('a narrow panel draws the sidebar narrower, leaving the mod room', narrow.drawn === 280, narrow.drawn);
    const titled = { height: 52, controlsWidth: 80 };
    const folded = LAYOUT.laidOut({
        size: { width: 1000, height: 700 },
        titleBar: titled,
        width: 300,
        collapsed: true,
        slot,
    });
    check(
        "folded, the content takes the panel and the frame covers only the window's buttons",
        folded.content.x === 0 &&
            LAYOUT.barRoom(titled) === 44 &&
            JSON.stringify(folded.obscured) === JSON.stringify({ x: 0, y: 0, width: 80, height: 52 }),
        folded
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} panel checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
