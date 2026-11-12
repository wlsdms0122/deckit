// What the test does to Deckit.app, as a person would, and what it checks along the way. Each check is a name, whether
// it held, and what was seen.
const fs = require('fs');
const path = require('path');
const { until, sleep, ALT, META, SHIFT } = require('./devtools.js');
const { seat } = require('./seat.js');

// The mods Deckit.app ships that are apps, which the Dock keeps from the first start: every one but the accessories,
// such as Deckit, the Switcher and Notifications.
const APPS = 8;
// The test's own apps: the window probe, which the test ships with the app as a system mod, so the Dock keeps it from
// the first start too, and the region parent, the window user and the web user, which the Dock lists as they run. The
// region child and the rest are accessories, in no list.
const PROBE = 'window-probe';
const TEST_APPS = 4;
// The test's own mods the person opens though the Dock does not keep them, and no work asks for them.
const OPENED = ['broker-user', 'broker-refused', 'open-user', 'window-user', 'web-user'];
const LINES = 'lines.txt';
const FOUND = 'source/quick-open-target.js';
const BROKEN = 'opens-everything';
// Where the region child's next revision is, which the window probe installs over the one there.
const NEXT_CHILD = 'region-child-next';
// A mod removed with its data whose web sessions were not cleared then, so what deck keeps of it is erased at start.
const REMOVED = 'removed-with-data';
// The Browser's tabs brought back: the one in front, and the one behind it, asleep.
const FRONT_TAB = 'https://example.com/';
const BEHIND_TAB = 'https://example.org/';

// A folder of files the Editor comes back to with LINES open, as a session it saved: an Open dialog cannot be driven.
// The test's own mods, installed, one of them declaring addresses as it may not, the window probe shipped with the app
// assembled in `app` as a system mod, Settings placed second in the Dock, as a person would have arranged it, and what
// REMOVED left, noted as not cleared yet.
function seed({ data, files, app }) {
    const mods = path.join(data, 'deckit', 'mods');
    fs.cpSync(path.join(__dirname, 'mods'), mods, { recursive: true });
    fs.rmSync(path.join(mods, PROBE), { recursive: true });
    shipProbe({ data, app });
    const next = path.join(data, NEXT_CHILD);
    fs.cpSync(path.join(__dirname, 'mods', 'region-child'), next, { recursive: true });
    fs.appendFileSync(path.join(next, 'main.js'), '// The next revision.\n');
    fs.mkdirSync(path.join(mods, BROKEN), { recursive: true });
    fs.writeFileSync(
        path.join(mods, BROKEN, 'manifest.toml'),
        [
            `id = "${BROKEN}"\nversion = "1.0.0"\napi = "1.0.0"\nmain = "main.js"\n`,
            '[[contributes."deckit/urls"]]\nscheme = "*"\n',
            '[[contributes."deckit/urls"]]\nscheme = "https"\n',
        ].join('\n')
    );
    fs.writeFileSync(path.join(mods, BROKEN, 'main.js'), 'module.exports = class { start() {} };\n');
    const contents = {
        [LINES]: Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n') + '\n',
        [FOUND]: 'export {};\n',
        'source/other.js': 'export {};\n',
    };
    for (const [name, text] of Object.entries(contents)) {
        fs.mkdirSync(path.dirname(path.join(files, name)), { recursive: true });
        fs.writeFileSync(path.join(files, name), text);
    }
    const lines = path.join(files, LINES);
    const session = { spaces: [{ root: files, open: [lines], active: lines, mode: 'files' }], active: files };
    const record = path.join(data, 'deckit', 'records', 'editor', 'session.json');
    fs.mkdirSync(path.dirname(record), { recursive: true });
    fs.writeFileSync(record, JSON.stringify(session));
    // Two tabs the Browser brings back, the one behind asleep.
    const tabs = [
        { id: 1, url: FRONT_TAB, title: 'Example', icon: '' },
        { id: 2, url: BEHIND_TAB, title: 'Behind', icon: '' },
    ];
    const browserRecord = path.join(data, 'deckit', 'records', 'browser', 'session.json');
    fs.mkdirSync(path.dirname(browserRecord), { recursive: true });
    fs.writeFileSync(browserRecord, JSON.stringify({ tabs, front: 1, closed: [] }));
    fs.mkdirSync(path.join(data, 'deckit', 'state', 'shell'), { recursive: true });
    fs.writeFileSync(
        path.join(data, 'deckit', 'state', 'shell', 'dock-pinned.json'),
        JSON.stringify(['editor', 'settings', 'bot', 'browser', 'calendar', 'finder', 'mods', 'note', PROBE])
    );
    fs.writeFileSync(path.join(data, 'deckit', 'deck.json'), JSON.stringify({ uncleared: [REMOVED] }));
    for (const kept of [
        ['records', REMOVED, 'tabs.json'],
        ['data', REMOVED, 'a.txt'],
    ]) {
        fs.mkdirSync(path.dirname(path.join(data, 'deckit', ...kept)), { recursive: true });
        fs.writeFileSync(path.join(data, 'deckit', ...kept), '{}');
    }
}

// The window probe, put beside the data, shipped with the app assembled in `app` after the mods it ships, a system mod:
// what it asks for is granted only to one. The app's configuration is kept under another name and handed on with it.
function shipProbe({ data, app }) {
    const folder = path.join(data, PROBE);
    fs.cpSync(path.join(__dirname, 'mods', PROBE), folder, { recursive: true });
    const config = path.join(app, 'config', 'config.js');
    fs.renameSync(config, path.join(app, 'config', 'shipped.js'));
    fs.writeFileSync(
        config,
        [
            "const shipped = require('./shipped.js');",
            `const probe = { folder: ${JSON.stringify(folder)}, system: true };`,
            'module.exports = { ...shipped, folders: { ...shipped.folders, ship: [...shipped.folders.ship, probe] } };',
            '',
        ].join('\n')
    );
}

// The data store WebKit keeps the session `partition` spells in: a UUID made from its name.
function storeOf(partition) {
    const hash = require('crypto').createHash('sha1').update(`deckit-web:${partition}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Whether two rects are the same to a point.
function near(a, b) {
    return !!a && !!b && ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) <= 1);
}

// `endCore()` kills the app's core, as a crash would; `logged()` is the app's log so far; `home` the app's folder; `id`
// the id it runs under.
async function run({
    page,
    pageById,
    pages,
    overlayOf,
    compose,
    targets,
    main,
    webPage,
    thrown,
    endCore,
    logged,
    home,
    files,
    id: appId,
}) {
    const report = [];
    const check = (name, ok, detail = '') => report.push({ name, ok: !!ok, detail: String(detail ?? '') });
    const { laidNow, desktopLaid, windowsNow, keyMod, windowOf, dockNow, dockClick, show, desktopShot } = seat({
        main,
        pageById,
        compose,
        desktop: () => desktop,
    });
    const asksAttention = async (id) => !!(await dockNow()).find((item) => item.id === id)?.attention;
    // What the strip over the desktop holds.
    const stripTitle = () =>
        desktop.evaluate(`document.querySelector('.deckit-desktop-strip .deckit-desktop-title')?.textContent`);
    // The host's stage, bottom to top, `{ id, url, name, opener, rect }` each; and whether the window probe's main
    // process module finds the window its page is shown in.
    const stackNow = async () =>
        ((await desktopLaid())?.pages || []).map(({ id, url, name, opener, rect }) => ({
            id,
            url,
            name,
            opener,
            rect,
        }));
    const probeFinds = async () => {
        const probe = await page('deckit://window-probe.mod');
        await probe?.evaluate(
            `delete document.documentElement.dataset.found; document.dispatchEvent(new CustomEvent('test-stack'))`
        );
        return (
            (await until(
                async () => (await probe?.evaluate('document.documentElement.dataset.found')) || false,
                4000
            )) === 'true'
        );
    };
    const namesOf = (stack) => stack.map(({ url, name }) => name || url.replace(/\/$/, ''));

    await sleep(9000);
    const desktop = await until(() => page('deckit://desktop'));
    // Only the background mods, and the mods whose interfaces they use, run as the app starts. The Dock keeps the
    // shipped apps, running or not, the window probe among them, and each is opened from it as a person opens it, the
    // Editor last, so it is in front. The region parent is opened from the Mods mod, and comes into the Dock as it
    // runs. The region child comes as its parent places it, the test's mods the Dock does not keep are opened as a
    // person opens them, and the rest run as their work asks for them.
    // The pages and the Dock are read together, until they agree on which mods run.
    let launchedAtStart = [];
    const runsAtStart = (id) => launchedAtStart.some((url) => url.startsWith(`deckit://${id}.mod`));
    const dockedAtStart =
        (await until(async () => {
            launchedAtStart = (await targets()).map(({ url }) => url);
            const dock = await dockNow();
            return dock.length && dock.every(({ id, running }) => running === runsAtStart(id)) && dock;
        })) || (await dockNow());
    check(
        'a background mod runs as the app starts',
        launchedAtStart.some((url) => url.startsWith('deckit://switcher.mod')),
        launchedAtStart.join(' ')
    );
    check(
        'Notifications, the owner of deckit/notifications, runs as the app starts',
        launchedAtStart.some((url) => url.startsWith('deckit://notifications.mod')),
        launchedAtStart.join(' ')
    );
    check(
        'a mod that is not a background mod does not run as the app starts',
        !launchedAtStart.some((url) => url.startsWith('deckit://editor.mod')),
        launchedAtStart.join(' ')
    );
    // A background app, Calendar, runs as the app starts, and Settings, whose interface it uses, with it; each opens
    // its window as it attaches.
    const idsAtStart = dockedAtStart.map(({ id }) => id);
    check(
        'the Dock keeps the shipped apps, running or not, and no accessory',
        idsAtStart.length === APPS + 1 &&
            idsAtStart.includes(PROBE) &&
            !['deckit', 'switcher', 'notifications', 'region-parent'].some((id) => idsAtStart.includes(id)) &&
            dockedAtStart.every(({ id, running }) => running === runsAtStart(id)),
        JSON.stringify(dockedAtStart)
    );
    const windowsAtLaunch = await windowsNow();
    const keyAtLaunch = windowsAtLaunch.find(({ key }) => key)?.mod ?? 'deckit';
    check(
        "the desktop starts with the windows of the apps that run, its strip holding the key one's name",
        windowsAtLaunch.every(({ mod }) => runsAtStart(mod)) && (await stripTitle())?.toLowerCase() === keyAtLaunch,
        JSON.stringify({ windows: windowsAtLaunch.map(({ mod }) => mod), title: await stripTitle() })
    );
    // The Dock slides out as the pointer comes to its sliver at the desktop's edge, the only part of the desktop's page
    // that takes the pointer there, and its item is pressed as a person presses it.
    const dockInput = async () => {
        const laid = (await desktopLaid())?.pages.find(({ url }) => url.startsWith('deckit://desktop'));
        return (laid?.input || []).find(({ x, height }) => x === 0 && height > 100)?.width ?? null;
    };
    const sliver = await dockInput();
    await desktop.evaluate(`document.querySelector('.deckit-dock').dispatchEvent(new PointerEvent('pointerenter'))`);
    const slidOut = await until(
        async () =>
            (await desktop.evaluate(`document.querySelector('.deckit-dock').hasAttribute('data-out')`)) &&
            (await dockInput()) > sliver &&
            (await dockInput()),
        2000
    );
    check(
        'the Dock is a sliver at the edge until the pointer comes, then takes the pointer whole',
        sliver > 0 && sliver < 10 && slidOut >= 60,
        `${sliver} -> ${slidOut}`
    );
    await sleep(400);
    await desktop.press(`.deckit-dock-item[data-mod-id="finder"]`);
    const launched = await until(async () => (await keyMod()) === 'finder', 6000);
    check(
        "a press on an app's Dock item launches it, its window in front as the key window",
        launched,
        JSON.stringify(await windowsNow())
    );
    await desktop.evaluate(`document.querySelector('.deckit-dock').dispatchEvent(new PointerEvent('pointerleave'))`);
    for (const id of idsAtStart) {
        if (id === 'editor' || id === 'finder') continue;
        await dockClick(id);
        await sleep(300);
    }
    await sleep(3000);
    // The Mods mod lists every app, and opens one the Dock does not keep.
    await show('mods');
    const allMods = await windowOf('mods');
    const gridIds = `[...document.querySelectorAll('.mods-item')].map((item) => item.dataset.modId)`;
    const grid = await until(
        async () => ((await allMods?.evaluate(gridIds)) || []).length && allMods.evaluate(gridIds)
    );
    check(
        'the Mods mod lists every app, and no accessory',
        Array.isArray(grid) &&
            ['region-parent', 'window-probe', 'editor'].every((id) => grid.includes(id)) &&
            !['region-child', 'switcher'].some((id) => grid.includes(id)),
        JSON.stringify(grid)
    );
    await allMods?.evaluate(`(() => {
        const field = document.querySelector('.mods-search input');
        field.value = 'probe';
        field.dispatchEvent(new Event('input'));
    })()`);
    const searched = await allMods?.evaluate(gridIds);
    check(
        'the Mods mod finds a mod by its name, best first',
        searched?.[0] === 'window-probe' && !searched.includes('editor'),
        JSON.stringify(searched)
    );
    await allMods?.shot('mods');
    await allMods?.evaluate(`document.querySelector('.mods-search .deckit-field-clear')?.click()`);
    await allMods?.evaluate(`document.querySelector('.mods-item[data-mod-id="region-parent"]').click()`);
    await until(() => page('deckit://region-parent.mod'), 4000);
    await sleep(300);
    const docked = await until(async () => (await dockNow()).length === APPS + 2 && dockNow(), 4000);
    check(
        'a mod opened from the Mods mod comes into the Dock as it runs, marked running',
        Array.isArray(docked) && docked.at(-1)?.id === 'region-parent' && docked.at(-1).running,
        JSON.stringify(docked)
    );
    // The test's mods the Dock does not keep and that no work asks for are opened as a person opens such a mod, from
    // the window probe's page; the owners of the interfaces they use launch with them.
    const probePage = await until(() => page('deckit://window-probe.mod'), 4000);
    await probePage?.evaluate(
        `document.dispatchEvent(new CustomEvent('test-load', { detail: ${JSON.stringify(OPENED)} }))`
    );
    const loaded = await until(
        async () => (await probePage?.evaluate('document.documentElement.dataset.loaded')) || false,
        8000
    );
    check(
        'a mod the Dock does not keep runs as the person opens it, with the owners of the interfaces it uses',
        loaded === OPENED.join() && !!(await page('deckit://broker-provider.mod')),
        loaded
    );
    await dockClick('editor');
    await until(async () => (await keyMod()) === 'editor', 6000);
    await sleep(3000);
    for (const target of await targets()) if (target.url.startsWith('deckit://')) await page(target.url);
    try {
        const editorPage = await page('deckit://editor.mod');
        const editor = await windowOf('editor');
        check('editor view up', editorPage && editor);
        const windowsAtStart = await windowsNow();
        check(
            "the Editor's window is in front as the key window, and the strip holds its name",
            windowsAtStart.at(-1)?.mod === 'editor' &&
                windowsAtStart.filter(({ key }) => key).length === 1 &&
                windowsAtStart.at(-1).key &&
                (await stripTitle()) === 'Editor',
            JSON.stringify({
                windows: windowsAtStart.map(({ mod, key }) => mod + (key ? ' key' : '')),
                title: await stripTitle(),
            })
        );
        const dock = await dockNow();
        const ids = dock.map(({ id }) => id);
        // The kept apps in the person's order, then those running that it does not keep, in the order they launched.
        check(
            `the Dock lists the ${APPS + 1} kept apps, then those running, in the order they launched`,
            ids.length === APPS + TEST_APPS &&
                JSON.stringify(ids.slice(APPS + 1)) === '["region-parent","window-user","web-user"]',
            JSON.stringify(ids)
        );
        check("the Dock's order is read back from the core", ids[1] === 'settings', JSON.stringify(ids));
        check(
            "the key window's mod's item is marked active, and each running one running",
            dock
                .filter(({ active }) => active)
                .map(({ id }) => id)
                .join() === 'editor' &&
                ['editor', 'finder', 'note', 'region-parent'].every(
                    (id) => dock.find((item) => item.id === id)?.running
                ),
            JSON.stringify(dock)
        );
        // The test's region parent has no icon.
        const sizes = await desktop.evaluate(
            `[...new Set([...document.querySelectorAll('.deckit-dock-item')].map((item) => item.offsetWidth + 'x' + item.offsetHeight))].join()`
        );
        const initial = await desktop.evaluate(
            `document.querySelector('.deckit-dock-item[data-mod-id="region-parent"]')?.textContent`
        );
        check(
            'a mod with no icon has an item as large as the others, with its initial',
            !String(sizes).includes(',') && initial === 'R',
            `${sizes} ${initial}`
        );

        // A running mod's Dock item brings its window front as the key window; the others stay open behind it.
        await show('finder');
        const finderFront = await windowsNow();
        check(
            'picking Finder in the Dock brings its window front as the key window',
            finderFront.at(-1)?.mod === 'finder' && finderFront.at(-1).key && (await stripTitle()) === 'Finder',
            JSON.stringify(finderFront.map(({ mod, key }) => mod + (key ? ' key' : '')))
        );
        check(
            "picking Finder leaves the Editor's window open behind it",
            finderFront.some(({ mod, key }) => mod === 'editor' && !key),
            ''
        );
        // A press in a window behind brings it front as the key window.
        await editor.press('.cm-content');
        const pressedFront = await until(async () => (await keyMod()) === 'editor', 3000);
        check(
            'a press in a window behind brings it front as the key window',
            pressedFront && (await windowsNow()).at(-1)?.mod === 'editor',
            await keyMod()
        );

        await editor.key(' ', 'Space', ALT, 32);
        const switcherPage = await until(() => page('deckit://switcher.mod'));
        // The switcher is a quick pick, a layer: drawn in its page's overlay, which has the keys while it is open.
        const switcher = switcherPage && (await until(() => overlayOf(switcherPage)));
        await until(async () => /Notes/.test((await switcher?.evaluate('document.body.innerText')) || ''));
        check('switcher opens on its chord', switcher);
        if (switcher) {
            // Its window is an overlay one, a window of the host app's of its own, never on the desktop.
            const floating = await until(async () => {
                const host = (await laidNow()).filter(({ stages }) =>
                    stages.some(({ pages: laid }) =>
                        laid.some(({ opener }) => opener.startsWith('deckit://switcher.mod'))
                    )
                );
                return host.length && host;
            }, 2000);
            const desktopWindow = (await laidNow()).find(({ stages }) =>
                stages.some(({ pages: laid }) => laid.some(({ url }) => url.startsWith('deckit://desktop')))
            );
            check(
                "the switcher's window is an overlay one, in a window of the host app's of its own",
                floating &&
                    floating.every(({ id }) => id !== desktopWindow?.id) &&
                    !(await windowsNow()).some(({ mod }) => mod === 'switcher'),
                JSON.stringify(floating && floating.map(({ id, width, height }) => ({ id, width, height })))
            );
            const items = await switcher.evaluate(`document.body.innerText`);
            check('switcher lists mods', /Notes/.test(items || ''), String(items).slice(0, 200));
            await switcher.shot('switcher');
            const activeLabel = `document.querySelector('[data-active] .switcher-label')?.textContent`;
            const first = await switcher.evaluate(activeLabel);
            await switcher.key('ArrowDown', 'ArrowDown', 0, 40);
            await sleep(200);
            const second = await switcher.evaluate(activeLabel);
            await switcher.key('ArrowUp', 'ArrowUp', 0, 38);
            await sleep(200);
            const third = await switcher.evaluate(activeLabel);
            check(
                'arrows move the active row',
                first && second && first !== second && third === first,
                `${first} -> ${second} -> ${third}`
            );
            await switcher.type('Show Notes');
            await sleep(1200);
            await switcher.shot('switcher-typed');
            const picked = await switcher.evaluate(activeLabel);
            await switcher.key('Enter', 'Enter', 0, 13);
            await until(async () => (await keyMod()) === 'note', 4000);
            check('switcher shows Notes', (await keyMod()) === 'note', `${picked}: ${await keyMod()} key`);
            // It goes as the mod it showed takes the keyboard, which no page of an app in the background has: put
            // away by its key here.
            const rows = `document.querySelectorAll('.switcher-row').length`;
            if (await switcher.evaluate(rows)) await switcher.key('Escape', 'Escape', 0, 27);
            await until(async () => (await switcher.evaluate(rows)) === 0, 3000);
        }

        await show('note');
        const notePage = await page('deckit://note.mod');
        const note = await windowOf('note');
        // The window's content is told where its buttons stand over its top, the title bar area past them.
        const guide = await note?.evaluate(`(() => {
            const style = document.documentElement.style;
            return [document.documentElement.hasAttribute('data-deckit-title-bar'), style.getPropertyValue('--deckit-title-bar-area-height'), style.getPropertyValue('--deckit-title-bar-area-x')].join(' ');
        })()`);
        check("a window's content is told where its buttons stand over its top", guide === 'true 38px 78px', guide);
        const notesKept = path.join(home, 'data', 'note');
        const notesMade = await until(() => fs.existsSync(notesKept), 3000);
        check("a main process module keeps what it keeps in its mod's data folder", notesMade, notesKept);
        const left = () =>
            [`records/${REMOVED}`, `data/${REMOVED}`].filter((kept) => fs.existsSync(path.join(home, kept)));
        const uncleared = () =>
            JSON.stringify(JSON.parse(fs.readFileSync(path.join(home, 'deck.json'), 'utf8')).uncleared ?? []);
        const erased = await until(() => !left().length && uncleared() === '[]', 4000);
        check('what a mod removed with its data left is erased at start', erased, `${left()} ${uncleared()}`);
        await note?.shot('note');
        const noteOverlay = await overlayOf(notePage);
        check(
            'nothing is left floating in a view',
            noteOverlay && !(await noteOverlay.evaluate(`document.body.childElementCount`)),
            await noteOverlay?.evaluate(`[...document.body.children].map((element) => element.className).join(' | ')`)
        );
        await show('settings');
        const settingsPage = await page('deckit://settings.mod');
        const settings = await windowOf('settings');
        // The rows come after the sections, once the list of mods is read.
        const versions = /Editor[\s\S]*1\.0\.0/;
        await until(async () => versions.test((await settings?.evaluate('document.body.innerText')) || ''), 4000);
        const text = (await settings?.evaluate('document.body.innerText')) || '';
        check(
            'settings shows its sections',
            ['Mods', 'Mod Settings', 'URL Schemes', 'Interfaces', 'Keyboard'].every((word) => text.includes(word)),
            text.slice(0, 400)
        );
        check('settings lists the mods with versions', versions.test(text), '');
        // URLs leaves out an entry beside a mod's "*", which takes every address: the mod is in each scheme's list by
        // its "*" alone, as Settings' URL Schemes lists them.
        const starred = `[...document.querySelectorAll('.settings-handler')]
            .filter((row) => row.querySelector('.settings-handler-name')?.textContent === '${BROKEN}')
            .map((row) => row.querySelector('.settings-scheme-patterns')?.textContent)`;
        const listedBy = await until(async () => {
            const found = (await settings?.evaluate(starred)) || [];
            return found.length > 1 && found;
        }, 3000);
        check(
            'a mod\'s addresses are judged by the URLs mod, which leaves out an entry beside its "*"',
            Array.isArray(listedBy) && listedBy.every((patterns) => patterns === 'every address'),
            JSON.stringify(listedBy || (await settings?.evaluate(starred)))
        );
        const selectable = await settings?.evaluate(`({
            unprefixed: CSS.supports('user-select', 'text'),
            failure: getComputedStyle(document.querySelector('.settings-mod-failure')).webkitUserSelect,
        })`);
        check(
            "text made selectable can be selected, such as a mod's failure",
            selectable?.failure === 'text',
            JSON.stringify(selectable)
        );
        await settings?.shot('settings');
        const activity = `[...document.querySelectorAll('.settings-section')].find((section) => section.querySelector('.settings-section-title').textContent === 'Activity')`;
        await settings?.evaluate(`${activity}.scrollIntoView({ block: 'start' })`);
        await sleep(200);
        await settings?.shot('settings-activity');
        const activityText = (await settings?.evaluate(`${activity}.innerText`)) || '';
        // Running: each mod that runs, a background one said so; then each background mod with its reason. A run
        // that is running says no state of its own under the Running card.
        const [running, background] = activityText.split(/\nIn the background\n/);
        check(
            'Activity lists the running mods, the background ones said so, and the background mods with why',
            /Switcher\s+In the background/.test(running) &&
                /\bEditor\b/.test(running) &&
                !/\bRunning\b/.test(running.split('\n').slice(2).join('\n')) &&
                /Notifications\s+Takes the notifications mods send/.test(background || ''),
            activityText.slice(0, 600)
        );
        const interfaces = `[...document.querySelectorAll('.settings-section')].find((section) => section.querySelector('.settings-section-title').textContent === 'Interfaces')`;
        await settings?.evaluate(`${interfaces}.scrollIntoView({ block: 'start' })`);
        await sleep(200);
        await settings?.shot('settings-interfaces');
        const actions = await settings?.evaluate(`[...${interfaces}.querySelectorAll('.settings-card')]
            .find((card) => card.querySelector('.settings-interface-name').textContent === 'switcher/actions')?.innerText`);
        check(
            'settings lists an interface with its owner, the first to provide it',
            /Automatic: Switcher/.test(actions || ''),
            actions || ''
        );
        // A menu is a layer, drawn in the page's overlay, which has the keys while it is open.
        const settingsOverlay = await overlayOf(settingsPage);
        const menus = `document.querySelectorAll('.deckit-menu[data-state="open"]').length`;
        // The size set in the General section is the Editor's, which leaves its own to the fonts, and is kept.
        const general = `[...document.querySelectorAll('.settings-section')].find((section) => section.querySelector('.settings-section-title').textContent === 'General')`;
        const less = `${general}.querySelector('.deckit-stepper-button[title="Less"]')`;
        const sizeShown = `${general}.querySelector('.deckit-stepper-input').value`;
        const codeSize = `getComputedStyle(document.querySelector('.cm-editor')).fontSize`;
        const sizeBefore = await editor.evaluate(codeSize);
        await settings?.evaluate(`${less}.scrollIntoView({ block: 'center' })`);
        await sleep(200);
        await settings?.shot('settings-general');
        check('the text size starts at the default, 14', (await settings?.evaluate(sizeShown)) === '14 px', '');
        await settings?.evaluate(`${less}.click()`);
        await settings?.evaluate(`${less}.click()`);
        const sized = await until(async () => (await editor.evaluate(codeSize)) === '12px', 3000);
        check(
            "the fonts' size picked in Settings is the Editor's text size",
            sized,
            `${sizeBefore} -> ${await editor.evaluate(codeSize)}`
        );
        const pageSize = `getComputedStyle(document.body).fontSize`;
        check(
            "a page's text that nothing styles is in the General size",
            (await settings?.evaluate(pageSize)) === '12px',
            await settings?.evaluate(pageSize)
        );
        const fontsKept = path.join(home, 'state', 'shell', 'fonts.json');
        const sizeKept = await until(
            () => fs.existsSync(fontsKept) && JSON.parse(fs.readFileSync(fontsKept, 'utf8')).size === 12,
            2000
        );
        check(
            "the fonts are kept in the shell's state",
            sizeKept,
            fs.existsSync(fontsKept) && fs.readFileSync(fontsKept)
        );
        // The Editor's size, left unset, shows Default and follows the General one; stepped, it is the Editor's own
        // from the General one, and cleared it is unset again.
        const editorSize = `[...document.querySelectorAll('.settings-setting-card')]
            .find((card) => card.querySelector('.settings-card-title')?.textContent === 'Editor')
            ?.querySelector('.deckit-stepper')`;
        const unsetShown = await settings?.evaluate(`(() => {
            const input = ${editorSize}?.querySelector('input');
            return input && { value: input.value, placeholder: input.placeholder };
        })()`);
        check(
            "a mod's size left unset shows Default",
            unsetShown?.value === '' && unsetShown?.placeholder === 'Default',
            JSON.stringify(unsetShown)
        );
        await settings?.evaluate(`${editorSize}.querySelector('[title="More"]').click()`);
        const stepped = await until(async () => (await editor.evaluate(codeSize)) === '13px', 3000);
        check(
            "a mod's size steps from the General one",
            stepped && (await settings?.evaluate(`${editorSize}.querySelector('input').value`)) === '13 px',
            `${await editor.evaluate(codeSize)} ${await settings?.evaluate(`${editorSize}.querySelector('input').value`)}`
        );
        await settings?.evaluate(`(() => {
            const input = ${editorSize}.querySelector('input');
            input.value = '';
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        })()`);
        const unsetAgain = await until(async () => (await editor.evaluate(codeSize)) === '12px', 3000);
        check(
            "a mod's size cleared follows the General one again",
            unsetAgain && (await settings?.evaluate(`${editorSize}.querySelector('input').value`)) === '',
            await editor.evaluate(codeSize)
        );
        // The General font offers every family installed, not a list of its own.
        const fontSelect = `${general}.querySelector('.deckit-select')`;
        await settings?.evaluate(`${fontSelect}.click()`);
        await until(() => settingsOverlay.evaluate(menus), 2000);
        const families = await settingsOverlay?.evaluate(
            `document.querySelectorAll('.deckit-menu [role^="menuitem"]').length`
        );
        check('the General font offers every family installed', families > 40, families);
        // A row wears its face as it nears the menu's view and the others a few each frame after, so a long list of
        // faces opens without reading them all in at once.
        const facedNow = () =>
            settingsOverlay?.evaluate(`(() => {
                const labels = [...document.querySelectorAll('.deckit-menu .deckit-menu-label')];
                const worn = labels.filter((label) => label.style.fontFamily).length;
                return worn && { worn, rows: labels.length };
            })()`);
        const faced = await until(facedNow, 2000);
        // A page off screen has its timers slowed after a while, so the rest are seen going on, not ending.
        const later = await until(async () => {
            const now = await facedNow();
            return now && now.worn >= faced.worn + 40 && now;
        }, 3000);
        check(
            'a long list of faces wears those in view first, and the rest after',
            faced && faced.worn < faced.rows / 2 && !!later,
            JSON.stringify({ faced, later })
        );
        await settingsOverlay?.key('Escape', 'Escape', 0, 27);
        await until(async () => !(await settingsOverlay.evaluate(menus)), 2000);
        // The overlay: a select opens its menu, keys move and pick, Escape and a press outside put a menu away. The
        // select is a mod's setting's.
        const firstSelect = `document.querySelector('.settings-setting .deckit-select')`;
        const before = await settings?.evaluate(`${firstSelect}?.textContent`);
        // Scrolled first and clicked a frame later: a scroll that lands after a menu opened puts it away.
        await settings?.evaluate(`${firstSelect}.scrollIntoView()`);
        await sleep(200);
        await settings?.evaluate(`${firstSelect}.click()`);
        const opened = await until(() => settingsOverlay.evaluate(menus), 2000);
        check(
            'a select opens its menu',
            opened === 1,
            `${before} ${opened} ${await settingsOverlay.evaluate(`[...document.querySelectorAll('.deckit-menu')].map((m) => m.dataset.state + m.className).join()`)}`
        );
        await settingsOverlay?.key('ArrowDown', 'ArrowDown', 0, 40);
        await settingsOverlay?.key('Enter', 'Enter', 0, 13);
        await sleep(400);
        const after = await settings?.evaluate(`${firstSelect}?.textContent`);
        check(
            'the keys pick from it and close it',
            after !== before && !(await settingsOverlay.evaluate(menus)),
            `${before} -> ${after}`
        );
        // Configuration keeps the values set in its records, one record for each mod.
        const configurationFolder = path.join(home, 'records', 'configuration');
        const configurationKept = await until(
            () => fs.existsSync(configurationFolder) && fs.readdirSync(configurationFolder).length,
            2000
        );
        check("a mod's configuration set is kept in Configuration's records", configurationKept, configurationFolder);
        await settings?.evaluate(`${firstSelect}.click()`);
        await until(() => settingsOverlay.evaluate(menus), 2000);
        // A mod's menu is in its page's overlay, over everything on the desktop, at its window; the mod's page, which
        // draws nothing there, is under the backdrop.
        const settingsFrame = async () => (await windowsNow()).find(({ mod }) => mod === 'settings')?.rect;
        const menuLaid = async () => {
            const stack = await stackNow();
            const top = stack.at(-1);
            return {
                over: top?.name === 'deckit-overlay' && top.opener.startsWith('deckit://settings.mod'),
                at: near(top?.rect, await settingsFrame()),
                under: ((at) => at > -1 && at < namesOf(stack).indexOf('backdrop'))(
                    namesOf(stack).findIndex((name) => name.startsWith('deckit://settings.mod'))
                ),
                stack: namesOf(stack),
            };
        };
        const floated = await menuLaid();
        check(
            "a mod's menu is in its overlay, over the desktop at its window, and the mod's page is under the backdrop",
            floated.over && floated.at && floated.under,
            JSON.stringify(floated)
        );
        await settingsOverlay?.key('Escape', 'Escape', 0, 27);
        await sleep(400);
        check('Escape puts a menu away', !(await settingsOverlay.evaluate(menus)), '');
        const settled = namesOf(await stackNow());
        const frames = settled.filter((name) => /^frame-/.test(name));
        check(
            "the backdrop is under every window, each window's frame under its content and its buttons over it, and the desktop's page over them",
            frames.length > 3 &&
                settled.indexOf('backdrop') < settled.indexOf(frames[0]) &&
                frames.every(
                    (name) => settled.indexOf(name.replace('frame-', 'buttons-')) > settled.indexOf(name) + 1
                ) &&
                settled.at(-1).startsWith('deckit://desktop'),
            JSON.stringify(settled)
        );
        // A menu opened from a window behind the key window is drawn at that window, over all.
        await show('finder');
        await settings?.evaluate(`${firstSelect}.click()`);
        await until(() => settingsOverlay.evaluate(menus), 2000);
        const behind = await menuLaid();
        check(
            'a menu opened from a window behind the key window is drawn at that window, over all',
            behind.over && behind.at && (await keyMod()) === 'finder',
            JSON.stringify({ ...behind, key: await keyMod() })
        );
        await settingsOverlay?.key('Escape', 'Escape', 0, 27);
        await until(async () => !(await settingsOverlay.evaluate(menus)), 2000);
        await show('settings');
        await settings?.evaluate(`${firstSelect}.click()`);
        await until(() => settingsOverlay.evaluate(menus), 2000);
        await settingsOverlay?.evaluate(
            `document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))`
        );
        await sleep(400);
        check('a press outside puts a menu away', !(await settingsOverlay.evaluate(menus)), '');
        const rowOf = (name) =>
            `[...document.querySelectorAll('.settings-mod')].find((row) => row.querySelector('.settings-mod-name')?.textContent === ${JSON.stringify(name)})`;
        await settings?.evaluate(`document.querySelector('.settings-body').scrollTo({ top: 0, behavior: 'instant' })`);
        // A mod's row, opened, tells what the mod has in each place deck keeps it, as the disk holds it.
        const filesIn = (folder) =>
            fs.existsSync(folder)
                ? fs
                      .readdirSync(folder, { withFileTypes: true })
                      .filter((entry) => !entry.name.startsWith('.'))
                      .reduce(
                          (sum, entry) => sum + (entry.isDirectory() ? filesIn(path.join(folder, entry.name)) : 1),
                          0
                      )
                : 0;
        const editorRow = `[...document.querySelectorAll('.settings-mod')].find((row) => row.querySelector('.settings-mod-name')?.textContent === 'Editor')`;
        await settings?.evaluate(`${editorRow}.querySelector('.settings-mod-row').click()`);
        const usageLine = `${editorRow}.querySelector('.settings-details-location > :last-child')?.textContent || ''`;
        const usage = await until(() => settings.evaluate(usageLine), 3000);
        await settings?.evaluate(`${editorRow}.querySelector('.settings-mod-row').click()`);
        const counted = (count, noun) => (count ? `${count} ${noun}${count === 1 ? '' : 's'}` : '');
        // What a layer keeps of the mod in its own state: the web engine its sessions and downloads, the shell the
        // frames of its windows and its place in the Dock.
        const stateOf = (folder, key) => {
            try {
                return JSON.parse(fs.readFileSync(path.join(home, 'state', folder, `${key}.json`), 'utf8'));
            } catch {
                return null;
            }
        };
        const layers = [
            ['web', ['web-sessions', 'web-downloads'].some((key) => stateOf('web', key)?.editor?.length > 0)],
            [
                'shell',
                stateOf('shell', 'dock-pinned')?.includes('editor') ||
                    Object.hasOwn(stateOf('shell', 'window-frames') ?? {}, 'editor'),
            ],
        ]
            .filter(([, keeps]) => keeps)
            .map(([name]) => name);
        // The row tells a layer's keeping by what Settings words it as, and any other name as it is.
        const keptText = { shell: 'window frames and Dock place', web: 'site data and downloads' };
        const told = [
            counted(filesIn(path.join(home, 'data', 'editor')), 'data file'),
            counted(filesIn(path.join(home, 'records', 'editor')), 'record'),
            ...[
                ...layers,
                ...(fs.existsSync(path.join(home, 'principal-state'))
                    ? fs.readdirSync(path.join(home, 'principal-state'))
                    : []
                )
                    .filter((name) => fs.existsSync(path.join(home, 'principal-state', name, 'editor.json')))
                    .filter((name) => !layers.includes(name))
                    .sort(),
            ].map((name) => (Object.hasOwn(keptText, name) ? keptText[name] : name)),
        ].filter(Boolean);
        check(
            "a mod's row tells what it has where deck keeps it",
            usage === (told.length ? told : ['Nothing stored']).join(' · '),
            `${usage} (the disk holds ${JSON.stringify(told)})`
        );

        // A folder dropped on the Mods section is asked about as a picked one is: one install refuses is told. While it
        // is over the section, the section says what a drop does there.
        const notMod = path.join(home, '..', 'not-a-mod');
        fs.mkdirSync(notMod, { recursive: true });
        const settingsId = (await windowsNow()).find(({ mod }) => mod === 'settings')?.content;
        const modsHead = await settings.evaluate(`(() => {
            const head = document.querySelector('.settings-mods .settings-section-head');
            head.scrollIntoView();
            const box = head.getBoundingClientRect();
            return { x: box.left + 20, y: box.top + 10 };
        })()`);
        const dropped = JSON.stringify({ files: [fs.realpathSync(notMod)], ...modsHead });
        const dropping = main(`return webkit.sendDrop(${settingsId}, ${dropped})`);
        const covered = await until(
            () => settings.evaluate(`getComputedStyle(document.querySelector('.settings-drop')).opacity === '1'`),
            1000
        );
        check('files dragged over the Mods section show where they install', covered, '');
        await dropping;
        const toastText = `document.querySelector('.deckit-toast')?.textContent || ''`;
        const refusedDrop = await until(
            async () => /^Could not install not-a-mod: /.test(await settingsOverlay?.evaluate(toastText)),
            4000
        );
        check(
            'a folder dropped on the Mods section is installed as a dry run, as a picked one is, and one install refuses is told',
            refusedDrop,
            await settingsOverlay?.evaluate(toastText)
        );
        // A second refusal stacks on the first, at the bottom right of the page, clear of its title bar.
        await main(`return webkit.sendDrop(${settingsId}, ${dropped})`);
        const stackOf = `(() => {
            const toasts = [...document.querySelectorAll('.deckit-toast')];
            const stack = document.querySelector('.deckit-toasts')?.getBoundingClientRect();
            return stack && { count: toasts.length, right: innerWidth - stack.right, bottom: innerHeight - stack.bottom, top: stack.top };
        })()`;
        const stacked = await until(async () => (await settingsOverlay?.evaluate(stackOf))?.count === 2, 4000);
        const stackSeen = await settingsOverlay?.evaluate(stackOf);
        const titleBottom = await settings.evaluate(
            `document.querySelector('.deckit-title-bar').getBoundingClientRect().bottom`
        );
        check(
            'toasts stack at the bottom right of the page, clear of its title bar',
            stacked && stackSeen.right === 12 && stackSeen.bottom === 12 && stackSeen.top >= titleBottom,
            JSON.stringify({ stackSeen, titleBottom })
        );
        // A folder whose package file names a mod not installed is dry run through deckit/packages: the sheet shows
        // what it depends on and why it cannot install, and offers no install.
        const needsAbsent = path.join(home, '..', 'needs-absent');
        fs.mkdirSync(needsAbsent, { recursive: true });
        fs.writeFileSync(
            path.join(needsAbsent, 'manifest.toml'),
            'id = "needs-absent"\nname = "Needs Absent"\nversion = "1.0.0"\napi = "1.0.0"\nmain = "main.js"\n'
        );
        fs.writeFileSync(path.join(needsAbsent, 'main.js'), 'module.exports = class { start() {} };\n');
        fs.writeFileSync(path.join(needsAbsent, 'package.toml'), '[dependencies]\nabsent-mod = "1.2"\n');
        const droppedNeeds = JSON.stringify({ files: [fs.realpathSync(needsAbsent)], ...modsHead });
        await main(`return webkit.sendDrop(${settingsId}, ${droppedNeeds})`);
        const sheetOf = `(() => {
            const title = document.querySelector('.deckit-modal-title')?.textContent;
            const row = document.querySelector('.settings-dependency');
            const buttons = [...document.querySelectorAll('.deckit-modal-actions button')].map((one) => one.textContent);
            return title && row && {
                title,
                row: row.textContent,
                unmet: row.querySelector('.settings-dependency-state').hasAttribute('data-unmet'),
                buttons,
            };
        })()`;
        const sheet = await until(() => settingsOverlay?.evaluate(sheetOf), 4000);
        check(
            'a folder whose dependency is not installed is shown with it, and offers no install',
            sheet?.title === 'Cannot install Needs Absent' &&
                sheet.row === 'absent-mod1.2Not installed' &&
                sheet.unmet &&
                JSON.stringify(sheet.buttons) === '["OK"]',
            JSON.stringify(sheet)
        );
        await settingsOverlay?.evaluate(
            `[...document.querySelectorAll('.deckit-modal-actions button')].find((one) => one.textContent === 'OK')?.click()`
        );
        await until(async () => !(await settingsOverlay?.evaluate(`!!document.querySelector('.deckit-modal')`)), 2000);
        const browserPage = await page('deckit://browser.mod');
        const browser = await windowOf('browser');
        // A tab's page is reached through its element, which names it once main has given it its id.
        const shownPage = `[...document.querySelectorAll('[data-web-page]')].find((element) => element.style.visibility === 'visible')?.dataset.webPage`;
        const front = webPage(await until(() => browser?.evaluate(shownPage), 3000));
        const store = (await front.state())?.store;
        check('browser web page is in its own session', store === storeOf(`persist:${appId}:browser:web`), store);
        const pagesShown = `document.querySelectorAll('[data-web-page]').length`;
        const asleep = await browser?.evaluate(pagesShown);
        check('a tab brought back sleeps until it comes to the front', asleep === 1, asleep);
        // A tab's row is found by its address, which its label carries: its title changes as its page loads.
        const pressTab = (url) =>
            browser?.evaluate(
                `[...document.querySelectorAll('.browser-row-label')].find((label) => label.title === '${url}')?.click()`
            );
        await pressTab(BEHIND_TAB);
        const woken = await until(async () => (await browser?.evaluate(pagesShown)) === 2, 3000);
        check('a tab asleep wakes as it comes to the front', woken, await browser?.evaluate(pagesShown));
        await pressTab(FRONT_TAB);
        const shownAt = async () => (await webPage(await browser?.evaluate(shownPage)).state())?.url;
        const frontAgain = await until(async () => (await shownAt()) === FRONT_TAB, 3000);
        check('a tab woken before comes back to the front', frontAgain, await shownAt());
        // What a site is told the browser is: the Safari whose WebKit shows it, and nothing of deckit's in its world.
        const identity = await front.evaluate(
            `({ agent: navigator.userAgent, hints: 'userAgentData' in navigator, webkit: typeof window.webkit })`
        );
        check(
            'a web page is told the Safari it runs on, with no name the app adds',
            /Version\/[\d.]+ Safari\/605\.1\.15$/.test(identity?.agent || '') &&
                !/Electron|Deckit|Chrome/.test(identity.agent) &&
                !identity.hints,
            JSON.stringify(identity)
        );
        check(
            "a web page's own world has no way to deckit",
            identity?.webkit === 'undefined',
            JSON.stringify(identity)
        );
        const toolbar = await browser?.evaluate(`(() => {
            const bar = document.querySelector('.browser-toolbar');
            const shown = [...document.querySelectorAll('[data-web-page]')].find((element) => element.style.visibility === 'visible');
            return {
                bar: Math.round(bar.getBoundingClientRect().bottom),
                page: Math.round(shown.getBoundingClientRect().top),
                field: !!bar.querySelector('.browser-address-field'),
                region: getComputedStyle(bar).getPropertyValue('--app-region'),
            };
        })()`);
        check(
            "the browser's page starts under its toolbar, which holds the address and drags the window",
            toolbar?.bar > 0 && toolbar.page >= toolbar.bar && toolbar.field && toolbar.region === 'drag',
            JSON.stringify(toolbar)
        );
        // WebKit's view of the front tab, in the Browser's page's view, where the tab's element is, while the Browser
        // is on screen.
        const onScreen = await keyMod();
        await show('browser');
        // A press in the toolbar's drag area and a drag move the Browser's window with the pointer, and the frame it is
        // left at is kept in the shell's state, by its mod and its window's name.
        const browserFrame = async () => (await windowsNow()).find(({ mod }) => mod === 'browser')?.rect;
        const dragFrom = await browser?.evaluate(`(() => {
            const bar = document.querySelector('.browser-toolbar').getBoundingClientRect();
            const y = Math.round(bar.top + bar.height / 2);
            for (let x = Math.round(bar.right) - 8; x > bar.left; x -= 4) {
                const found = document.elementFromPoint(x, y);
                if (found && getComputedStyle(found).getPropertyValue('--app-region').trim() === 'drag') return { x, y };
            }
            return null;
        })()`);
        const movedFrom = await browserFrame();
        const movedBy = (rect) => rect?.x === movedFrom?.x + 30 && rect.y === movedFrom.y + 20;
        if (dragFrom && movedFrom) {
            const contentId = (await windowsNow()).find(({ mod }) => mod === 'browser').content;
            const mouse = (type, { x, y }) =>
                main(`return webkit.sendMouse(${contentId}, ${JSON.stringify({ type, x, y })})`);
            await mouse('down', dragFrom);
            await mouse('dragged', { x: dragFrom.x + 30, y: dragFrom.y + 20 });
            // The window has moved under the pointer: the point it is let go at is where it was pressed in the page.
            await until(async () => movedBy(await browserFrame()), 2000);
            await mouse('up', dragFrom);
        }
        const movedTo = await until(async () => {
            const at = await browserFrame();
            return movedBy(at) && at;
        }, 2000);
        check(
            "a drag in a window's drag area moves the window with the pointer",
            !!movedTo,
            JSON.stringify({ dragFrom, movedFrom, now: await browserFrame() })
        );
        const framesKept = path.join(home, 'state', 'shell', 'window-frames.json');
        const keptFrame = () => {
            try {
                return JSON.parse(fs.readFileSync(framesKept, 'utf8'));
            } catch {
                return null;
            }
        };
        check(
            "the frame a window is left at is kept in the shell's state, by its mod and its window's name",
            await until(() => near(keptFrame()?.browser?.main, movedTo), 2000),
            JSON.stringify(keptFrame()?.browser)
        );
        // What a site hands over as a file to keep is written to the Downloads folder under its name once the Browser's
        // question is answered, and the tab stays on its page. One refused is not written and not listed.
        const server = require('http').createServer((_request, response) => {
            response.writeHead(200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="report.csv"',
            });
            response.end('a,b\n1,2\n');
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const shownPageId = await browser?.evaluate(shownPage);
        const download = () => main(`return webkit.load(${shownPageId}, 'http://127.0.0.1:${server.address().port}/')`);
        const answerDownload = (label) =>
            until(async () => {
                const overlay = await overlayOf(browserPage);
                return overlay?.evaluate(`(() => {
                    const title = document.querySelector('.deckit-modal-title');
                    const button = [...document.querySelectorAll('.deckit-modal-actions button')].find(
                        (button) => button.textContent === ${JSON.stringify(label)}
                    );
                    if (!title || !button) return '';
                    button.click();
                    return title.textContent;
                })()`);
            }, 5000);
        await download();
        const refusedTitle = await answerDownload('Cancel');
        await until(
            async () => !(await (await overlayOf(browserPage))?.evaluate(`!!document.querySelector('.deckit-modal')`)),
            2000
        );
        await download();
        const askedTitle = await answerDownload('Download');
        check(
            'the Browser asks before a download is saved',
            refusedTitle === 'Download “report.csv”?' && askedTitle === refusedTitle,
            [refusedTitle, askedTitle]
        );
        const downloaded = await until(
            () =>
                main(`const file = require('path').join(require('electron').app.getPath('downloads'), 'report.csv');
                    return require('fs').existsSync(file) && require('fs').readFileSync(file, 'utf8')`),
            5000
        );
        server.close();
        const refusedWritten = await main(
            `return require('fs').existsSync(require('path').join(require('electron').app.getPath('downloads'), 'report (2).csv'))`
        );
        check(
            'a file a site hands over is downloaded under its name, and one refused is not',
            downloaded === 'a,b\n1,2\n' && refusedWritten === false,
            [downloaded, refusedWritten]
        );
        check('the tab that downloaded stays on its page', (await shownAt()) === FRONT_TAB, await shownAt());
        // A window a tab's page opens is a tab after it that is the site's window: the page holds it and the window
        // knows its opener. Opened again by its name, the same tab is reused.
        {
            const site = require('http').createServer((request, response) => {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                if (request.url === '/child') {
                    return response.end('<script>window.opener && window.opener.postMessage("hello", "*")</script>');
                }
                response.end(`<button style="position:fixed;inset:0" onclick="
                    held = window.open('/child', 'named') ? 'held' : 'lost';
                    pressed++;
                    show();
                ">open</button><script>
                    let held = '', pressed = 0, heard = 0;
                    const show = () => (document.title = held + ' ' + pressed + ' ' + heard);
                    addEventListener('message', () => (heard++, show()));
                </script>`);
            });
            await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
            const openerPage = `http://127.0.0.1:${site.address().port}/`;
            const tabs = `document.querySelectorAll('.browser-row-label').length`;
            const tabsBefore = await browser?.evaluate(tabs);
            const openerId = await browser?.evaluate(shownPage);
            await main(`return webkit.load(${openerId}, '${openerPage}')`);
            await until(
                async () => (await shownAt()) === openerPage && !(await webPage(openerId).state())?.loading,
                5000
            );
            const press = async () => {
                for (const type of ['down', 'up'])
                    await main(`return webkit.sendMouse(${openerId}, { type: '${type}', x: 40, y: 40 })`);
            };
            await press();
            const titled = async () => (await webPage(openerId).state())?.title;
            const heard = await until(async () => (await titled()) === 'held 1 1', 5000);
            const added = await until(async () => (await browser?.evaluate(tabs)) === tabsBefore + 1, 3000);
            const beside = await browser?.evaluate(`(() => {
                const labels = [...document.querySelectorAll('.browser-row-label')].map((label) => label.title);
                return labels.indexOf('${openerPage}child') === labels.indexOf('${openerPage}') + 1;
            })()`);
            check(
                "a tab's window is a tab after it, held by the page, which hears from it",
                heard && added && beside,
                JSON.stringify({ title: await titled(), tabs: await browser?.evaluate(tabs), beside })
            );
            await pressTab(openerPage);
            await until(async () => (await shownAt()) === openerPage, 3000);
            // A press is lost while the tab comes back on screen, so it is pressed until the page counts it.
            await until(async () => {
                if ((await titled()).split(' ')[1] === '1') await press();
                return (await titled()).split(' ')[1] === '2';
            }, 5000);
            await until(async () => (await titled()) === 'held 2 2', 8000);
            check(
                'a window opened again by its name is the same tab',
                (await titled()) === 'held 2 2' && (await browser?.evaluate(tabs)) === tabsBefore + 1,
                JSON.stringify({ title: await titled(), tabs: await browser?.evaluate(tabs) })
            );
            await pressTab(`${openerPage}child`);
            const windowId = await until(async () => {
                const id = await browser?.evaluate(shownPage);
                return id !== openerId && id;
            }, 3000);
            await main(`return webkit.load(${windowId}, '${openerPage}moved')`);
            const moved = await until(
                async () => (await webPage(windowId).state())?.url === `${openerPage}moved`,
                5000
            );
            check(
                "a tab's window loads an address as any tab does",
                moved,
                JSON.stringify(await webPage(windowId).state())
            );
            // The tabs this made go, so the tab the next opens a tab from is the one in front.
            const made = `[...document.querySelectorAll('.browser-row-label')]
                .map((label) => label.title)
                .find((title) => title.startsWith('${openerPage}') && title !== '${openerPage}')`;
            for (let left = await browser?.evaluate(made); left; left = await browser?.evaluate(made)) {
                const count = await browser?.evaluate(tabs);
                await pressTab(left);
                await browser?.key('w', 'KeyW', META, 87);
                if (!(await until(async () => (await browser?.evaluate(tabs)) < count, 2000))) break;
            }
            site.close();
            await pressTab(openerPage);
            await main(`return webkit.load(${openerId}, '${FRONT_TAB}')`);
            await until(async () => (await shownAt()) === FRONT_TAB, 5000);
        }
        // A link to a file that opens a tab: the tab, which shows no page, closes once the download is asked about, and
        // the tab the link is in stays.
        {
            const site = require('http').createServer((request, response) => {
                if (request.url === '/gone.csv') return request.socket.destroy();
                if (request.url === '/file') {
                    response.writeHead(200, {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': 'attachment; filename="opened.csv"',
                    });
                    return response.end('c,d\n3,4\n');
                }
                response.writeHead(200, { 'Content-Type': 'text/html' });
                const link = request.url === '/failing' ? 'href="/gone.csv" download' : 'href="/file" target="_blank"';
                response.end(`<a ${link} style="position:fixed;inset:0;display:block">a file</a>`);
            });
            await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
            const linkPage = `http://127.0.0.1:${site.address().port}/`;
            const tabs = `document.querySelectorAll('.browser-row-label').length`;
            const tabsBefore = await browser?.evaluate(tabs);
            const linkPageId = await browser?.evaluate(shownPage);
            await main(`return webkit.load(${linkPageId}, '${linkPage}')`);
            await until(
                async () => (await shownAt()) === linkPage && !(await webPage(linkPageId).state())?.loading,
                5000
            );
            for (const type of ['down', 'up'])
                await main(`return webkit.sendMouse(${linkPageId}, { type: '${type}', x: 40, y: 40 })`);
            const opened = await until(async () => (await browser?.evaluate(tabs)) === tabsBefore + 1, 3000);
            const asked = await answerDownload('Download');
            const closed = await until(async () => (await browser?.evaluate(tabs)) === tabsBefore, 3000);
            const saved = await until(
                () =>
                    main(`const file = require('path').join(require('electron').app.getPath('downloads'), 'opened.csv');
                        return require('fs').existsSync(file) && require('fs').readFileSync(file, 'utf8')`),
                5000
            );
            check(
                'a tab a link opened for a file closes once the download is asked, and the file is saved',
                opened && asked === 'Download “opened.csv”?' && closed && saved === 'c,d\n3,4\n',
                JSON.stringify({ opened, asked, closed, saved, tabs: await browser?.evaluate(tabs) })
            );
            check('the tab with the link stays on its page', (await shownAt()) === linkPage, await shownAt());
            // A link to a file that fails before it is answered is listed as failed, and its tab stays on its page.
            const failingPage = `${linkPage}failing`;
            await main(`return webkit.load(${linkPageId}, ${JSON.stringify(failingPage)})`);
            await until(
                async () => (await shownAt()) === failingPage && !(await webPage(linkPageId).state())?.loading,
                5000
            );
            for (const type of ['down', 'up'])
                await main(`return webkit.sendMouse(${linkPageId}, { type: '${type}', x: 40, y: 40 })`);
            check('the tab whose file failed stays on its page', (await shownAt()) === failingPage, await shownAt());
            site.close();
            await main(`return webkit.load(${linkPageId}, '${FRONT_TAB}')`);
            await until(async () => (await shownAt()) === FRONT_TAB, 5000);
        }
        // A site that focuses a field of its own as it loads does not take the keyboard from the address being edited;
        // an address typed and gone to gives the page the keyboard.
        {
            const site = require('http').createServer((_request, response) => {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end('<input autofocus>');
            });
            await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
            const focusing = `http://127.0.0.1:${site.address().port}/`;
            const tabId = await browser?.evaluate(shownPage);
            const holder = `(() => {
                const held = document.activeElement;
                return held?.dataset.webPage ? 'page ' + held.dataset.webPage : held?.className || '';
            })()`;
            await browser?.key('l', 'KeyL', META, 76);
            await main(`return webkit.load(${tabId}, '${focusing}')`);
            await until(async () => (await shownAt()) === focusing && !(await webPage(tabId).state())?.loading, 5000);
            await sleep(600);
            const kept = await browser?.evaluate(holder);
            check(
                'a site focusing its own field leaves the address being edited the keyboard',
                kept === 'browser-address-input',
                kept
            );
            await browser?.type(FRONT_TAB);
            await browser?.key('Enter', 'Enter', 0, 13);
            await until(async () => (await shownAt()) === FRONT_TAB, 5000);
            const given = await browser?.evaluate(holder);
            check('an address gone to gives the page the keyboard', given === `page ${tabId}`, given);
            site.close();
        }
        // A new tab shows the start page, with no web page shown over it, and its address being edited.
        {
            const tabCount = `document.querySelectorAll('.browser-row-label').length`;
            const before = await browser?.evaluate(tabCount);
            await browser?.key('t', 'KeyT', META, 84);
            const opened = await until(async () => (await browser?.evaluate(tabCount)) === before + 1, 3000);
            await sleep(300);
            const started = await browser?.evaluate(`({
                start: !!document.querySelector('.browser-start[data-shown]'),
                held: document.activeElement?.className || '',
                shown: [...document.querySelectorAll('[data-web-page]')].some((element) => element.style.visibility === 'visible'),
            })`);
            check(
                'a new tab shows the start page and has its address being edited',
                opened && started?.start && !started.shown && started.held === 'browser-address-input',
                started
            );
            await browser?.key('w', 'KeyW', META, 87);
            const closedTab = await until(async () => (await browser?.evaluate(tabCount)) === before, 3000);
            check(
                "⌘W the Browser's window handles closes its tab, and the shell's Close Window does not run",
                closedTab && (await windowsNow()).some(({ mod }) => mod === 'browser'),
                await windowsNow()
            );
            await pressTab(FRONT_TAB);
            await until(async () => (await shownAt()) === FRONT_TAB, 3000);
        }
        // A key a tab's web page did not handle is next the Browser window's document's, where its element is: ⌘W with
        // the keyboard in the web page closes the tab, and the window stays.
        {
            const site = require('http').createServer((_request, response) => {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end('<p>a page</p>');
            });
            await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
            const plain = `http://127.0.0.1:${site.address().port}/`;
            const tabCount = `document.querySelectorAll('.browser-row-label').length`;
            const before = await browser?.evaluate(tabCount);
            await browser?.key('t', 'KeyT', META, 84);
            await until(async () => (await browser?.evaluate(tabCount)) === before + 1, 3000);
            await browser?.type(plain);
            await browser?.key('Enter', 'Enter', 0, 13);
            const tabId = await until(async () => (await shownAt()) === plain && browser?.evaluate(shownPage), 5000);
            const held = `document.activeElement?.dataset.webPage`;
            await until(async () => (await browser?.evaluate(held)) === String(tabId), 3000);
            // A page takes input once it is on screen, laid in its window's stage.
            const laidPage = async () =>
                (await laidNow()).some(({ stages }) =>
                    stages.some(({ pages: laid }) => laid.some(({ id }) => String(id) === String(tabId)))
                );
            await until(laidPage, 3000);
            await main(`return webkit.sendKey(${Number(tabId)}, { code: 'KeyW', key: 'w', meta: true })`);
            const closedTab = await until(async () => (await browser?.evaluate(tabCount)) === before, 3000);
            check(
                "⌘W in a tab's web page closes the tab, and the Browser's window stays",
                closedTab && (await windowsNow()).some(({ mod }) => mod === 'browser'),
                JSON.stringify({ tabs: await browser?.evaluate(tabCount), windows: await windowsNow() })
            );
            site.close();
            await pressTab(FRONT_TAB);
            await until(async () => (await shownAt()) === FRONT_TAB, 3000);
        }
        // The host's menu has the app's items, Quit among them, and the Edit items a text field copies and pastes
        // through, and none for closing or minimizing a window: those are the shell's keys, after the content.
        {
            const roles =
                await main(`return require('electron').Menu.getApplicationMenu().items.flatMap(({ submenu }) =>
                submenu.items.flatMap(({ role }) => (role ? [role.toLowerCase()] : [])))`);
            check(
                "the host's menu quits and edits, and does not close or minimize a window",
                ['quit', 'copy', 'paste', 'selectall'].every((role) => roles?.includes(role)) &&
                    !roles?.some((role) => ['close', 'minimize'].includes(role)),
                roles
            );
        }
        // Find is a bar on a layer over the page, in the Browser's overlay, which takes the pointer only where the bar
        // lies, and has the focus as it opens; closed, the overlay is off the page, which has the keyboard again.
        {
            const laidPages = async () =>
                (await laidNow()).flatMap(({ stages }) => stages.flatMap(({ pages: laid }) => laid));
            const overlaid = async () =>
                (await laidPages()).find(({ name, input }) => name === 'deckit-overlay' && input?.length);
            const responderIs = async (id) => (await laidPages()).some((laid) => laid.id === id && laid.responder);
            await browser?.key('f', 'KeyF', META, 70);
            const overlay = await until(() => overlayOf(browserPage), 3000);
            // Once it has shown: as it fades in, it grows to its size.
            const panelNow = () =>
                overlay?.evaluate(`(() => {
                    const found = document.querySelector('.browser-find')?.getBoundingClientRect();
                    return found && { x: found.x, y: found.y, width: found.width, height: found.height };
                })()`);
            let panel = null;
            let laid = null;
            const matched = await until(async () => {
                panel = await panelNow();
                laid = await overlaid();
                return !!panel && laid?.input.length === 1 && near(laid.input[0], panel);
            }, 3000);
            check(
                'the find bar is on a layer over the page, and its overlay takes the pointer only where it lies',
                matched,
                JSON.stringify({ panel, input: laid?.input })
            );
            // The keyboard the page has goes to the overlay only in a key window, which this app, never active, lacks.
            const held = await overlay?.evaluate(`!!document.activeElement?.closest('.browser-find')`);
            // The overlay wears the page's rules as written, so the count is in the face of the field beside it.
            await overlay?.evaluate(`(() => {
                const input = document.querySelector('.browser-find input');
                input.value = 'e';
                input.dispatchEvent(new Event('input'));
            })()`);
            const faces = await until(
                () =>
                    overlay?.evaluate(`(() => {
                        const count = document.querySelector('.deckit-find-count');
                        const face = (element) => { const { fontFamily, fontSize } = getComputedStyle(element); return fontFamily + ' ' + fontSize; };
                        return count.textContent && { count: face(count), field: face(document.querySelector('.browser-find input')) };
                    })()`),
                3000
            );
            check('the find count is in the face of its field', faces?.count === faces?.field, JSON.stringify(faces));
            const tabId = Number(await browser?.evaluate(shownPage));
            const selected = () => webPage(tabId).evaluate('String(getSelection())');
            const found = await until(async () => !!(await selected()), 3000);
            await overlay?.key('Escape', 'Escape', 0);
            const gone = await until(async () => !(await overlaid()), 3000);
            const letGo = await until(async () => (await selected()) === '', 3000);
            check(
                'closing the find bar lets go of the match it selected',
                found && letGo,
                JSON.stringify({ found, letGo })
            );
            const back = await until(() => responderIs(tabId), 2000);
            check(
                'closing the find bar takes its overlay off and gives the page the keyboard',
                gone && back,
                JSON.stringify({ gone, back })
            );
            // Shown again once its exit played out, it is drawn whole, as the first time.
            await browser?.key('f', 'KeyF', META, 70);
            const opacity = () =>
                overlay?.evaluate(`(() => {
                    const found = document.querySelector('.browser-find');
                    return found ? getComputedStyle(found).opacity : '';
                })()`);
            const whole = await until(async () => (await opacity()) === '1', 3000);
            check('the find bar shown again is drawn whole', whole, await opacity());
            await overlay?.key('Escape', 'Escape', 0);
            await until(async () => !(await overlaid()), 3000);
        }
        // Where the front tab's element is on the desktop, its window's content's origin and its place in it; and the
        // web pages laid there.
        const tabLaidOut = async () => {
            const origin = await browserFrame();
            const element = await browser?.evaluate(`(() => {
                const shown = [...document.querySelectorAll('[data-web-page]')].find((element) => element.style.visibility === 'visible');
                const { x, y, width, height } = shown.getBoundingClientRect();
                return { x, y, width, height };
            })()`);
            const at = element && origin && { ...element, x: origin.x + element.x, y: origin.y + element.y };
            const views = ((await desktopLaid())?.pages || []).filter(
                ({ url }) => !url.startsWith('deckit://') && url !== 'about:blank'
            );
            return { at, views };
        };
        const tabLaid = await until(async () => {
            const { at, views } = await tabLaidOut();
            return (views || []).some(({ rect }) => near(rect, at));
        }, 3000);
        check(
            "a tab's page is laid in the Browser's window, where its element is",
            tabLaid,
            JSON.stringify(await tabLaidOut())
        );
        // A menu over the Browser is in its overlay, over the web page, which stays shown under it as it is.
        const browserOverlay = await overlayOf(browserPage);
        await browser?.evaluate(`(() => {
            const row = document.querySelector('.browser-row-label');
            const { x, y } = row.getBoundingClientRect();
            row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x + 4, clientY: y + 4 }));
        })()`);
        const menuShown = await until(
            () => browserOverlay?.evaluate(`!!document.querySelector('.deckit-menu[data-state="open"]')`),
            3000
        );
        const overPage = await stackNow();
        const underMenu = await tabLaidOut();
        check(
            "a menu over a web page is in the mod's overlay, and the web page stays shown under it",
            menuShown &&
                overPage.at(-1)?.name === 'deckit-overlay' &&
                overPage.at(-1).opener.startsWith('deckit://browser.mod') &&
                (underMenu.views || []).some(({ rect }) => near(rect, underMenu.at)),
            JSON.stringify({ menuShown, top: overPage.at(-1), views: underMenu.views })
        );
        // What is presented lies on a backdrop the overlay takes every press over the page by, and has the focus there.
        const presentedOver = async () => {
            const laid = (await laidNow()).flatMap(({ stages }) => stages.flatMap(({ pages: each }) => each));
            const over = laid.find(({ name, input }) => name === 'deckit-overlay' && input?.length);
            return {
                covers: !!over?.input.some(({ x, y, width, height }) =>
                    near({ x, y, width, height }, { x: 0, y: 0, width: over.rect.width, height: over.rect.height })
                ),
                focused: await browserOverlay?.evaluate(`!!document.activeElement?.closest('.deckit-menu')`),
            };
        };
        const presented = await presentedOver();
        check(
            'a menu lies on a backdrop that takes every press over the page, and holds the focus in the overlay',
            presented.covers && presented.focused,
            JSON.stringify(presented)
        );
        await browserOverlay?.key('Escape', 'Escape', 0, 27);
        await until(async () => !(await browserOverlay?.evaluate('document.body.childElementCount')), 2000);
        // What a tab downloaded is listed from the toolbar's button, which shows once there is any.
        await browser?.evaluate(`(() => {
            const button = document.querySelector('.browser-downloads-button');
            if (!button.hidden) button.click();
        })()`);
        const listedDownloads = await until(
            () =>
                browserOverlay?.evaluate(
                    `[...document.querySelectorAll('.browser-download')].map((row) => row.dataset.state + ' ' + row.querySelector('.browser-download-name').textContent).join()`
                ),
            3000
        );
        check(
            'the Browser lists what its tabs downloaded',
            listedDownloads === 'failed gone.csv,finished opened.csv,finished report.csv',
            listedDownloads
        );
        await browserOverlay?.key('Escape', 'Escape', 0, 27);
        await until(async () => !(await browserOverlay?.evaluate('document.body.childElementCount')), 2000);
        await show(onScreen);
        const drawn = await desktop.evaluate(
            `[...document.querySelectorAll('.deckit-dock-item svg')].filter((svg) => svg.children.length).length`
        );
        check("every app's icon is drawn in the Dock", drawn === APPS, drawn);
        const ran = await editorPage.evaluate(`new Promise((resolve) => {
            const image = document.createElement('img');
            image.setAttribute('onerror', 'window.ranInPage = true');
            image.src = 'deckit://editor.mod/missing';
            document.body.appendChild(image);
            setTimeout(() => {
                image.remove();
                resolve(!!window.ranInPage);
            }, 1500);
        })`);
        check("nothing runs in a view's page world", ran === false, ran);
        const notices = await editorPage.evaluate(`Notification.requestPermission()`);
        check("a mod's page gets no web permission", notices === 'denied', notices);
        await editorPage.evaluate(`location.href = 'deckit://finder.mod/'`);
        await sleep(1500);
        const stayed = (await targets()).filter((target) => target.url.startsWith('deckit://finder.mod')).length;
        check("a mod's view cannot move to another mod's origin", stayed === 1, stayed + ' finder pages');
        await show('editor');
        await editor.key(' ', 'Space', ALT, 32);
        const again = await overlayOf(await page('deckit://switcher.mod'));
        const listed = await until(
            async () => /Open Folder/.test((await again?.evaluate('document.body.innerText')) || ''),
            5000
        );
        check('a refused navigation leaves the page its keys', listed, '');
        await again?.key('Escape', 'Escape', 0, 27);
        // A stage shown with no page shown on it draws nothing and still takes the window's clicks: the switcher's
        // window goes with it.
        const stagesNow = async () =>
            (await laidNow()).flatMap(({ stages }) =>
                stages.map(({ shown, pages: laid }) => ({ shown, pages: laid.map(({ url, opener }) => opener || url) }))
            );
        const shows = (stage, url) => stage.pages.some((shown) => shown.startsWith(url));
        const putAway = await until(async () => {
            const stages = await stagesNow();
            return stages.length && !stages.some((stage) => shows(stage, 'deckit://switcher.mod')) && stages;
        }, 3000);
        check(
            'the switcher put away leaves no window of its own, and no stage over a window',
            putAway && !putAway.some(({ shown, pages }) => shown && !pages.length),
            JSON.stringify(putAway || (await stagesNow()))
        );
        await show('editor');
        // The cursor's line in the editor that has the page's keyboard. The app under test is never the active one, so
        // no page has the system's focus and CodeMirror never marks itself focused.
        const activeLine = `document.activeElement?.closest('.cm-editor')?.querySelector('.cm-activeLine')?.textContent`;
        await until(async () => (await editor.evaluate(activeLine)) === 'line 1', 4000);
        await editor.key('l', 'KeyL', META, 76);
        // A quick pick is a layer, drawn in the page's overlay, which has the keys while it is open.
        const editorOverlay = await overlayOf(editorPage);
        const lineField = await until(() =>
            editorOverlay?.evaluate(`!!document.querySelector('.deckit-quick-pick-field')`)
        );
        check('Go to Line opens as a panel', lineField, '');
        await editorOverlay?.type('12');
        await sleep(200);
        await editorOverlay?.shot('go-to-line');
        await editorOverlay?.key('Enter', 'Enter', 0, 13);
        await until(async () => (await editor.evaluate(activeLine)) === 'line 12', 2000);
        check(
            'Go to Line moves the cursor',
            (await editor.evaluate(activeLine)) === 'line 12',
            await editor.evaluate(activeLine)
        );
        await editor.key('p', 'KeyP', META, 80);
        await until(() => editorOverlay?.evaluate(`!!document.querySelector('.deckit-quick-pick-field')`));
        await editorOverlay?.type('target');
        const names = `[...document.querySelectorAll('.editor-quick-open-name')].map((name) => name.textContent).join()`;
        const found = await until(
            async () => /quick-open-target\.js/.test((await editorOverlay?.evaluate(names)) || ''),
            4000
        );
        await editorOverlay?.shot('open-quickly');
        check(
            'Open Quickly finds a file by part of its name',
            found,
            await editorOverlay?.evaluate(`document.querySelector('.deckit-quick-pick-message')?.textContent`)
        );
        await editorOverlay?.key('Escape', 'Escape', 0, 27);
        // Every mod's screen, drawn: what the test does not drive is still seen.
        for (const id of ['editor', 'finder', 'browser', 'note', 'bot']) {
            await show(id);
            await sleep(800);
            await (await windowOf(id))?.shot('screen-' + id);
            await desktopShot('desktop-' + id);
        }
        // Bot draws its sessions from forge/sessions, which Forge provides.
        check('Bot shows, using the interface Forge provides', (await keyMod()) === 'bot', `${await keyMod()} key`);

        // What mods give each other over a connection, judged by the core: the exports a mod opened in start for an
        // interface, in its user's start; functions handed either way, each called on the page that handed it; the
        // exports a mod opened in attach, in its user's attach as they connect; and a signal its owner sends of it.
        const provider = await page('deckit://broker-provider.mod');
        const user = await page('deckit://broker-user.mod');
        // The screen is launched for the connection the user listens for as its attach runs.
        const screen = await until(() => page('deckit://broker-screen.mod'), 4000);
        const mark = (session, name) => session?.evaluate(`document.documentElement.dataset.${name}`);
        const asked = await until(async () => (await mark(user, 'asked')) === '42 broker-user', 4000);
        check(
            'a call reaches the exports a mod opened in start for an interface, made for the mod that connected',
            asked,
            await mark(user, 'asked')
        );
        const calledBack = await until(async () => (await mark(user, 'counted')) === '1,2,3', 4000);
        check(
            'a function handed over is called back on the page that handed it',
            calledBack,
            await mark(user, 'counted')
        );
        const thing = await until(async () => (await mark(user, 'thing')) === '7: 7 hello provider', 4000);
        check(
            "an object handed over crosses with its data, and its class's methods are called on it",
            thing,
            await mark(user, 'thing')
        );
        const same = await until(async () => (await mark(user, 'same')) === 'false true', 4000);
        check(
            'a function handed twice on one connection is the same function on the other end',
            same,
            await mark(user, 'same')
        );
        const rejected = await until(async () => (await mark(user, 'refused')) === 'call LATER not now', 4000);
        check(
            'what a function handed over throws reaches its caller as a refusal at call, with its kind and message',
            rejected,
            await mark(user, 'refused')
        );
        check(
            'a mod runs while no mod provides an interface it uses, connected to the one provided alone',
            asked && (await mark(user, 'lasting')) === 'broker-provider/broker',
            await mark(user, 'lasting')
        );
        const pinged = await until(async () => (await mark(user, 'pinged')) === '7', 4000);
        check('a signal of an interface reaches the mod that uses it and listens', pinged, await mark(user, 'pinged'));
        const screened = await until(
            async () =>
                (await mark(screen, 'connected')) === 'broker-user' &&
                (await mark(user, 'wrapped')) === '2 broker-user',
            4000
        );
        check(
            "the exports a mod opened in attach reach its user's attach as they connect, made for the mod that connected",
            screened,
            `${await mark(screen, 'connected')} ${await mark(user, 'wrapped')}`
        );
        const handedOn = await mark(user, 'handedOn');
        check(
            'a function another mod handed over is not handed on to a third',
            /is not handed on/.test(handedOn || ''),
            handedOn
        );
        const refusedFailure = `${rowOf('Broker Refused')}?.querySelector('.settings-mod-failure')?.textContent || ''`;
        const refusedRow = await until(
            async () =>
                /broker-refuser\/refusals did not connect: .*no connections here/.test(
                    await settings.evaluate(refusedFailure)
                ),
            4000
        );
        // Using an interface is never required: the user starts without the connection refused, and hears the refusal.
        const refusedPage = await page('deckit://broker-refused.mod');
        check(
            'a connection the owner of an interface refuses is heard by its user, which starts without it',
            refusedRow &&
                (await mark(refusedPage, 'started')) === '1' &&
                (await mark(refusedPage, 'refused')) === 'call REFUSED',
            `${await settings.evaluate(refusedFailure)} started: ${await mark(refusedPage, 'started')} ` +
                `refused: ${await mark(refusedPage, 'refused')}`
        );
        const failureBoxes = `(() => {
            const row = ${rowOf('Broker Refused')};
            const box = (selector) => row?.querySelector(selector)?.getBoundingClientRect().toJSON();
            return { failure: box('.settings-mod-failure'), row: box('.settings-mod-row') };
        })()`;
        const { failure, row } = await settings.evaluate(failureBoxes);
        check(
            'what is wrong with a mod is said inside its row, which the pointer washes and a press opens',
            failure?.height > 0 && failure.top >= row.top && failure.bottom <= row.bottom,
            JSON.stringify({ failure, row })
        );

        const screenNote = `${rowOf('Broker Screen')}?.querySelector('.settings-mod-note')?.textContent || ''`;
        const mismatched = await until(
            async () =>
                (await settings.evaluate(screenNote)).includes(
                    'uses broker-provider/broker 2, and its owner broker-provider provides it at 1, so it reaches no one'
                ),
            4000
        );
        check(
            'an interface used at a major its owner does not provide reaches no one, and the row says why, quietly',
            mismatched,
            await settings.evaluate(screenNote)
        );

        // Keys, as Keymap runs them: a mod's key that works anywhere in the app, declared to run its command,
        // launching its mod as it is pressed, and bound again by the window probe, a system mod, through deckit/keys.
        await show('editor');
        check(
            'a mod with a declared key does not run before the key is pressed',
            !(await page('deckit://keys-user.mod')),
            ''
        );
        await editor.key('9', 'Digit9', META | SHIFT, 57);
        const keys = await until(() => page('deckit://keys-user.mod'), 4000);
        const pressed = await until(async () => (await mark(keys, 'pressed')) === '1', 3000);
        check(
            "a mod's declared key that reaches the app launches its mod and runs from another mod's page",
            pressed,
            await mark(keys, 'pressed')
        );
        const services = await page(`deckit://${PROBE}.mod`);
        const keystroke = { code: 'Digit8', meta: true, control: false, alt: false, shift: true };
        const binding = { mod: 'keys-user', command: 'mark', keystroke };
        await services?.evaluate(
            `document.dispatchEvent(new CustomEvent('test-bind', { detail: ${JSON.stringify(binding)} }))`
        );
        const bound = await until(async () => (await mark(services, 'bound')) === '⇧⌘8', 3000);
        await keys?.evaluate(`document.dispatchEvent(new CustomEvent('test-chord'))`);
        const chordRead = await until(async () => (await mark(keys, 'chord')) === '⇧⌘8', 3000);
        await editor.key('8', 'Digit8', META | SHIFT, 56);
        const moved = await until(async () => (await mark(keys, 'pressed')) === '2', 3000);
        check(
            'a key bound again runs on its new chord, which its mod reads',
            bound && chordRead && moved,
            `${await mark(services, 'bound')} ${await mark(keys, 'chord')} ${await mark(keys, 'pressed')}`
        );

        // Addresses and queries, as URLs routes them: an address of a scheme a mod declares reaches it, one under a
        // path another mod declares reaches that one first, and what a mod resolves is in the switcher and runs.
        const opener = await page('deckit://open-user.mod');
        const openFrom = (url) =>
            opener?.evaluate(
                `delete document.documentElement.dataset.answered; document.dispatchEvent(new CustomEvent('test-open', { detail: ${JSON.stringify(url)} }))`
            );
        await openFrom(' TEST-OPEN:hello ');
        const reached = await until(
            async () =>
                (await mark(opener, 'opened')) === 'TEST-OPEN:hello' && (await mark(opener, 'answered')) === 'true',
            3000
        );
        check('an address of a scheme a mod asks for reaches it', reached, await mark(opener, 'opened'));
        const deep = 'test-open://probe/deep/1';
        await openFrom(deep);
        // The mod that asks for the path is launched as its turn for the address comes.
        const pathOpener = await until(() => page('deckit://open-user-path.mod'), 4000);
        const narrower = await until(
            async () => (await mark(pathOpener, 'opened')) === deep && (await mark(opener, 'answered')) === 'true',
            3000
        );
        check(
            'an address under a path a mod asks for is offered to it before the mod that asks for its whole scheme',
            narrower && (await mark(opener, 'opened')) === 'TEST-OPEN:hello',
            `${await mark(pathOpener, 'opened')} ${await mark(opener, 'opened')}`
        );
        const elsewhere = 'test-open://probe/elsewhere';
        await openFrom(elsewhere);
        const wider = await until(async () => (await mark(opener, 'opened')) === elsewhere, 3000);
        check(
            'an address outside the path a mod asks for goes to the mod that asks for its scheme',
            wider && (await mark(pathOpener, 'opened')) === deep,
            `${await mark(pathOpener, 'opened')} ${await mark(opener, 'opened')}`
        );
        await editor.key(' ', 'Space', ALT, 32);
        const query = await until(async () => overlayOf(await page('deckit://switcher.mod')));
        await until(async () => /Notes/.test((await query?.evaluate('document.body.innerText')) || ''));
        await query?.type('probe open user');
        const resolved = await until(
            async () => /Open User Probe/.test((await query?.evaluate('document.body.innerText')) || ''),
            4000
        );
        await query?.key('Enter', 'Enter', 0, 13);
        const picked = await until(async () => (await mark(opener, 'ran')) === '1', 3000);
        check('what a mod resolves is in the switcher and runs', resolved && picked, `${resolved} ${picked}`);

        // The switcher opens by its command too, run by the window probe, a system mod, through deckit/commands, and a
        // mod's own window holds its page at the size the mod gives.
        const rowsOf = async () => query?.evaluate(`document.querySelectorAll('.switcher-row').length`);
        await query?.key('Escape', 'Escape', 0, 27);
        await until(async () => (await rowsOf()) === 0, 3000);
        const windowed = await page('deckit://window-user.mod');
        await services?.evaluate(`document.dispatchEvent(new CustomEvent('test-switcher'))`);
        check('the switcher opens by its command', await until(async () => (await rowsOf()) > 0, 3000), await rowsOf());
        await query?.key('Escape', 'Escape', 0, 27);
        await until(async () => (await rowsOf()) === 0, 3000);
        // A mod's windows on the desktop, as the window user opens them by name: the first, opened on its own while
        // another mod's window is key, right behind the key window, not key, its Dock item asking for attention until
        // a click on it brings the window front as the key window; the next, opened as the active mod, in front as the
        // key window, cascaded from it; each at the size it gives, told as it appears and becomes key. ⌘` brings the
        // other in front, ⌘M puts the key window into the mod's Dock item, which brings it back, zoom fills the desktop
        // but the Dock's sliver and the page sees its content resized, ⌘W closes the key window, and the mod runs on
        // with none until its Dock item calls its reopen(), which finds the window where it was left.
        {
            const send = (type, detail) =>
                windowed?.evaluate(
                    `document.dispatchEvent(new CustomEvent('${type}', { detail: ${JSON.stringify(detail)} }))`
                );
            const userWindows = async () => (await windowsNow()).filter(({ mod }) => mod === 'window-user');
            const toldNow = async () => (await mark(windowed, 'told')) || '';
            const keyContent = async () => pageById((await windowsNow()).find(({ key }) => key)?.content);
            const listedWindows = async () => {
                await windowed?.evaluate(`delete document.documentElement.dataset.windows`);
                await send('test-windows', null);
                return mark(windowed, 'windows');
            };
            const keyBefore = await keyMod();
            await send('test-window-open', { name: 'one', width: 420, height: 300 });
            const opened = await until(async () => (await userWindows())[0], 4000);
            await sleep(300);
            const held = await windowsNow();
            const keyAt = held.findIndex(({ key }) => key);
            check(
                "a window a mod opens on its own while another mod's window is key opens right behind the key window, " +
                    'not key, its Dock item asking for attention',
                !!keyBefore &&
                    keyBefore !== 'window-user' &&
                    held[keyAt]?.mod === keyBefore &&
                    held[keyAt - 1]?.id === opened?.id &&
                    !held[keyAt - 1].key &&
                    (await asksAttention('window-user')),
                JSON.stringify({
                    windows: held.map(({ mod, key }) => mod + (key ? ' key' : '')),
                    dock: (await dockNow()).find(({ id }) => id === 'window-user'),
                })
            );
            await dockClick('window-user');
            const one = await until(async () => {
                const [first] = await userWindows();
                return first?.key && first;
            }, 4000);
            check(
                "a click on a mod's Dock item brings its window front as the key window, the strip holding its mod's " +
                    'name, and puts its mark for attention away',
                one?.id === opened?.id &&
                    (await windowsNow()).at(-1)?.mod === 'window-user' &&
                    (await stripTitle()) === 'Window User' &&
                    !(await asksAttention('window-user')),
                JSON.stringify({ one, title: await stripTitle(), dock: await dockNow() })
            );
            check(
                "a mod's window opens at the size it gives",
                one?.rect.width === 420 && one.rect.height === 300,
                JSON.stringify(one?.rect)
            );
            check(
                'a window is told it appeared, then that it became key',
                await until(async () => (await toldNow()) === 'one didAppear,one didBecomeKey,', 2000),
                await toldNow()
            );
            await send('test-window-open', { name: 'two', width: 420, height: 300 });
            const two = await until(async () => {
                const found = (await userWindows()).find(({ id }) => id !== one?.id);
                return found?.key && found;
            }, 4000);
            await sleep(300);
            const toldTwo = await toldNow();
            check(
                'a new window cascades from the key window, which resigns key as the new one becomes key',
                two?.rect.x === one?.rect.x + 24 &&
                    two.rect.y === one.rect.y + 24 &&
                    toldTwo.includes('one didResignKey,') &&
                    toldTwo.indexOf('two didAppear,') < toldTwo.indexOf('two didBecomeKey,'),
                JSON.stringify({ one: one?.rect, two: two?.rect, told: toldTwo })
            );
            check(
                "a mod's windows are listed by name, the key one said so",
                (await listedWindows()) === 'one,two key',
                await listedWindows()
            );
            await send('test-window-open', { name: 'one' });
            const reopenedOne = await until(
                async () => (await userWindows()).at(-1)?.id === one?.id && (await keyMod()) === 'window-user',
                3000
            );
            check(
                'opening a window by the name of one open brings that one front as the key window',
                reopenedOne && (await userWindows()).length === 2,
                JSON.stringify(await userWindows())
            );
            await (await keyContent())?.key('`', 'Backquote', META, 192);
            const cycled = await until(async () => {
                const front = (await windowsNow()).at(-1);
                return front?.id === two?.id && front.key;
            }, 3000);
            check(
                "⌘` brings the active mod's next window front as the key window",
                cycled,
                JSON.stringify(await userWindows())
            );
            await (await keyContent())?.key('m', 'KeyM', META, 77);
            const minimized = await until(async () => {
                const left = await userWindows();
                return left.length === 1 && left[0].id === one?.id && left[0].key;
            }, 3000);
            check(
                "⌘M takes the key window off the desktop, and the mod's next window becomes key",
                minimized && (await toldNow()).includes('two didDisappear,'),
                JSON.stringify({ windows: await userWindows(), told: await toldNow() })
            );
            await dockClick('window-user');
            const restored = await until(async () => {
                const back = await userWindows();
                return back.length === 2 && back.at(-1).key && back;
            }, 3000);
            check(
                "a running mod's Dock item brings its windows front, the minimized one too, the front one key",
                !!restored,
                JSON.stringify(await userWindows())
            );
            // The zoom button fills the desktop but the Dock's sliver, and the page's ResizeObserver sees the content
            // so; pressed again it gives the window its frame back.
            const front = (await userWindows()).at(-1);
            const buttons = await pageById((await stackNow()).find(({ name }) => name === `buttons-${front?.id}`)?.id);
            const area = await desktopLaid();
            const strip = await desktop.evaluate(`document.querySelector('.deckit-desktop-strip').offsetHeight`);
            const sizeName = 'size' + (front?.id === one?.id ? 'one' : 'two');
            const framesBefore = Number(await mark(windowed, 'frames'));
            await buttons?.press('[data-button="zoom"]');
            const zoomedIn = { x: 6, y: strip, width: area?.rect.width - 6, height: area?.rect.height - strip };
            const zoomed = await until(async () => near((await userWindows()).at(-1)?.rect, zoomedIn), 3000);
            const seen = await until(
                async () => (await mark(windowed, sizeName)) === `${zoomedIn.width}x${zoomedIn.height}`,
                2000
            );
            check(
                "the zoom button fills the desktop but the Dock's sliver",
                zoomed,
                JSON.stringify({ now: (await userWindows()).at(-1)?.rect, zoomedIn })
            );
            check(
                "a mod's window observes its content resize, and draws frames while it is open",
                seen && Number(await mark(windowed, 'frames')) > framesBefore + 5,
                `${await mark(windowed, sizeName)} ${framesBefore} -> ${await mark(windowed, 'frames')}`
            );
            await buttons?.press('[data-button="zoom"]');
            const unzoomed = await until(async () => near((await userWindows()).at(-1)?.rect, front?.rect), 3000);
            check(
                'zoomed again, a window has its frame back',
                unzoomed,
                JSON.stringify((await userWindows()).at(-1)?.rect)
            );
            // The frame a mod's page resizes its window to is where the window of that name opens next.
            await send('test-window-resize', { name: 'one', width: 500, height: 320 });
            const resized = await until(async () => {
                const found = (await userWindows()).find(({ id }) => id === one?.id);
                return found?.rect.width === 500 && found.rect.height === 320 && found;
            }, 3000);
            check("a mod's page resizes its window", !!resized, JSON.stringify(await userWindows()));
            await (await keyContent())?.key('w', 'KeyW', META, 87);
            await until(async () => (await userWindows()).length === 1, 3000);
            await (await keyContent())?.key('w', 'KeyW', META, 87);
            const allClosed = await until(async () => !(await userWindows()).length, 3000);
            check(
                '⌘W closes the key window, and the mod runs on with none, its Dock item running',
                allClosed &&
                    (await toldNow()).includes('one didClose,') &&
                    (await toldNow()).includes('two didClose,') &&
                    (await dockNow()).find(({ id }) => id === 'window-user')?.running,
                JSON.stringify({ windows: await userWindows(), told: await toldNow() })
            );
            await dockClick('window-user');
            const reopened = await until(async () => {
                const [found] = await userWindows();
                return found?.key && found;
            }, 3000);
            check(
                "a running mod's Dock item with no window open calls its reopen()",
                reopened && (await mark(windowed, 'reopened')) === '1',
                `${await mark(windowed, 'reopened')} ${JSON.stringify(reopened)}`
            );
            check(
                'a window opens where its mod left the window of its name',
                near(reopened?.rect, resized?.rect),
                JSON.stringify({ left: resized?.rect, opened: reopened?.rect })
            );
            const closing = await pageById(
                (await stackNow()).find(({ name }) => name === `buttons-${reopened?.id}`)?.id
            );
            await closing?.press('[data-button="close"]');
            check(
                'the close button closes its window',
                await until(async () => !(await userWindows()).length, 3000),
                JSON.stringify(await userWindows())
            );
        }
        // A file the active mod opens, the window probe through deckit/urls, which hands it to the Editor: the Editor
        // brings its window front as the key window.
        {
            await show(PROBE);
            const url = require('url').pathToFileURL(path.join(files, 'source', 'other.js')).href;
            const probeKey = await keyMod();
            await services?.evaluate(
                `delete document.documentElement.dataset.opened; document.dispatchEvent(new CustomEvent('test-open', { detail: ${JSON.stringify(url)} }))`
            );
            const fileFront = await until(async () => {
                const front = (await windowsNow()).at(-1);
                return front?.mod === 'editor' && front.key && (await mark(services, 'opened')) === 'true';
            }, 5000);
            check(
                'a file the active mod opens brings the window of the mod that opens it front as the key window',
                probeKey === PROBE && fileFront && (await stripTitle()) === 'Editor',
                JSON.stringify({
                    before: probeKey,
                    opened: await mark(services, 'opened'),
                    windows: (await windowsNow()).map(({ mod, key }) => mod + (key ? ' key' : '')),
                })
            );
        }
        // A mod's web window is a window on the desktop: its web page under the title bar the shell draws, which holds
        // the page's title and its site, so a page cannot pass for another, and it goes as the mod closes it.
        const webUser = await page('deckit://web-user.mod');
        await webUser?.evaluate(`document.dispatchEvent(new CustomEvent('test-web-open', { detail: '${FRONT_TAB}' }))`);
        // The desktop's web window: its frame, and the web page laid over it.
        const webWindow = async () => {
            const stack = await stackNow();
            const at = stack.findIndex(
                ({ url }, index) => /^https?:/.test(url) && /^frame-\d+$/.test(stack[index - 1]?.name || '')
            );
            return at > 0 ? { frame: stack[at - 1], content: stack[at] } : null;
        };
        const webAt = await until(async () => (await mark(webUser, 'at')) === FRONT_TAB, 8000);
        const shownIn = await until(webWindow, 3000);
        const titleNow = async () =>
            (await pageById((await webWindow())?.frame.id))?.evaluate(
                `document.querySelector('.deckit-window-title:not([hidden])')?.textContent`
            );
        const webTitle = await until(
            async () => /\(example\.com\)$/.test((await titleNow()) || '') && titleNow(),
            3000
        );
        // The frame's surface is the window grown by its shadow.
        const SHADOW = 32;
        check(
            "a mod's web window is a window on the desktop, its page under the title bar the shell draws, with its site",
            webAt &&
                shownIn &&
                shownIn.content.rect.x === shownIn.frame.rect.x + SHADOW &&
                shownIn.content.rect.y === shownIn.frame.rect.y + SHADOW + 38 &&
                webTitle === 'Example Domain (example.com)',
            `${await mark(webUser, 'at')} ${webTitle} ${JSON.stringify(shownIn)}`
        );
        await webUser?.evaluate(`document.dispatchEvent(new CustomEvent('test-web-close'))`);
        const webClosed = await until(async () => (await webWindow()) === null, 3000);
        check("a mod's web window goes as the mod closes it", webClosed, JSON.stringify(await webWindow()));
        // What a session's page was given is the session's: read once the page is gone, the cookie it set is sent.
        {
            const site = require('http').createServer((request, response) => {
                if (request.url === '/sign-in') {
                    response.writeHead(200, { 'Set-Cookie': 'probe=kept; Path=/; Max-Age=3600' });
                    return response.end('signed in');
                }
                response.end(request.headers.cookie || 'no cookie');
            });
            await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
            const at = `http://127.0.0.1:${site.address().port}`;
            await webUser?.evaluate(
                `document.dispatchEvent(new CustomEvent('test-web-open', { detail: '${at}/sign-in' }))`
            );
            await until(async () => (await mark(webUser, 'loaded')) === `${at}/sign-in`, 8000);
            await webUser?.evaluate(`document.dispatchEvent(new CustomEvent('test-web-close'))`);
            await until(async () => (await webWindow()) === null, 3000);
            await webUser?.evaluate(`document.dispatchEvent(new CustomEvent('test-web-fetch', {
                detail: { as: 'kept', url: '${at}/echo' },
            }))`);
            const answer = await until(() => mark(webUser, 'kept'), 5000);
            const read = Buffer.from(JSON.parse(answer || '{}').bytes || []).toString();
            site.close();
            check(
                "a session's fetch sends the cookies its page was given, once the page is gone",
                read === 'probe=kept',
                read
            );
        }

        // A session's fetch is a page's fetch sent as the session: it follows redirects, keeps the cookies answers set
        // and sends them again, sends a body and headers, reads bytes, and answers a status that is no success.
        {
            const site = require('http').createServer((request, response) => {
                const parts = [];
                request.on('data', (part) => parts.push(part));
                request.on('end', () => {
                    if (request.url === '/set') {
                        response.writeHead(302, { Location: '/echo', 'Set-Cookie': 'probe=kept; Path=/' });
                        return response.end();
                    }
                    if (request.url === '/bytes') return response.end(Buffer.from([0, 255, 1, 254]));
                    if (request.url === '/large') return response.end(Buffer.alloc(4 * 1024 * 1024 + 1));
                    if (request.url === '/none') {
                        response.writeHead(204);
                        return response.end();
                    }
                    if (request.url !== '/echo') {
                        response.writeHead(404);
                        return response.end('gone');
                    }
                    const { method, headers } = request;
                    const echo = {
                        method,
                        body: Buffer.concat(parts).toString(),
                        probe: headers['x-probe'],
                        agent: headers['user-agent'],
                    };
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ ...echo, cookie: headers.cookie }));
                });
            });
            await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
            const at = `http://127.0.0.1:${site.address().port}`;
            const fetched = async (as, url, init) => {
                await webUser?.evaluate(`document.dispatchEvent(new CustomEvent('test-web-fetch', {
                    detail: ${JSON.stringify({ as, url, init })},
                }))`);
                const answer = await until(() => mark(webUser, as), 5000);
                return answer ? JSON.parse(answer) : null;
            };
            const bodyOf = (answer) => Buffer.from(answer?.bytes || []).toString();
            const followed = await fetched('followed', `${at}/set`);
            const posted = await fetched('posted', `${at}/echo`, {
                method: 'POST',
                headers: [
                    ['X-Probe', 'sent'],
                    ['User-Agent', 'Probe/1'],
                ],
                body: Buffer.from('hello').toString('base64'),
            });
            const bytes = await fetched('bytes', `${at}/bytes`);
            const missing = await fetched('missing', `${at}/missing`);
            const manual = await fetched('manual', `${at}/set`, { redirect: 'manual' });
            const refused = await fetched('refused', `${at}/set`, { redirect: 'error' });
            const none = await fetched('none', `${at}/none`);
            const large = await fetched('large', `${at}/large`);
            site.close();
            const echoed = (answer) => JSON.parse(bodyOf(answer) || '{}');
            check(
                "a session's fetch follows a redirect and sends the cookie it set",
                followed?.url === `${at}/echo` && followed.redirected && echoed(followed).cookie === 'probe=kept',
                JSON.stringify(followed)
            );
            check(
                "a session's fetch sends its method, headers, user agent and body, and the session's cookies",
                JSON.stringify(echoed(posted)) ===
                    JSON.stringify({
                        method: 'POST',
                        body: 'hello',
                        probe: 'sent',
                        agent: 'Probe/1',
                        cookie: 'probe=kept',
                    }),
                JSON.stringify(posted)
            );
            check(
                "a session's fetch reads an answer's bytes, and answers a status that is no success",
                JSON.stringify(bytes?.bytes) === '[0,255,1,254]' &&
                    missing?.status === 404 &&
                    bodyOf(missing) === 'gone',
                JSON.stringify([bytes, missing])
            );
            check(
                "a session's fetch heeds the request's redirect",
                manual?.status === 302 &&
                    manual.headers.location === '/echo' &&
                    !manual.redirected &&
                    refused?.kind === 'REFUSED',
                JSON.stringify([manual, refused])
            );
            check(
                "a session's fetch answers no body for a status with none, and refuses an answer past its limit",
                none?.status === 204 && none.bytes === null && large?.kind === 'QUOTA_EXCEEDED',
                JSON.stringify([none, large])
            );
        }

        // A region in the parent's window: the child is laid over it, between the window's content and its buttons,
        // and goes as the window is minimized, back as its Dock item brings it.
        await show('region-parent');
        const parent = await page('deckit://region-parent.mod');
        const parentWindow = await windowOf('region-parent');
        const child = await page('deckit://region-child.mod');
        const slot = `(() => { const r = document.getElementById('region-slot').getBoundingClientRect(); return [r.width, r.height].map(Math.round).join('x'); })()`;
        const seen = `document.documentElement.dataset.shown === 'yes' ? innerWidth + 'x' + innerHeight : 'hidden'`;
        const laid = await until(
            async () => (await child.evaluate(seen)) === (await parentWindow?.evaluate(slot)),
            3000
        );
        check(
            'a region in a window lays its child over it',
            laid,
            `${await child.evaluate(seen)} in ${await parentWindow?.evaluate(slot)}, ${await keyMod()} key`
        );
        const regionStack = await stackNow();
        const parentId = (await windowsNow()).find(({ mod }) => mod === 'region-parent')?.id;
        const at = (match) => regionStack.findIndex(match);
        const childAt = at(({ url }) => url.startsWith('deckit://region-child.mod'));
        const slotAt = await parentWindow?.evaluate(
            `(() => { const r = document.getElementById('region-slot').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`
        );
        const parentFrame = (await windowsNow()).find(({ id }) => id === parentId)?.rect;
        check(
            "a child shown in a region is over its parent's window's content and under its buttons, where the region is",
            childAt >
                at(
                    ({ opener, name }) =>
                        opener.startsWith('deckit://region-parent.mod') && /^deckit-window-/.test(name)
                ) &&
                childAt < at(({ name }) => name === `buttons-${parentId}`) &&
                near(
                    regionStack[childAt]?.rect,
                    slotAt && parentFrame && { ...slotAt, x: parentFrame.x + slotAt.x, y: parentFrame.y + slotAt.y }
                ),
            JSON.stringify({ stack: namesOf(regionStack), child: regionStack[childAt]?.rect, slotAt, parentFrame })
        );
        await parentWindow?.key('m', 'KeyM', META, 77);
        const gone = await until(async () => (await child.evaluate(seen)) === 'hidden', 3000);
        check("minimizing the parent's window takes its region away", gone, await child.evaluate(seen));
        await dockClick('region-parent');
        const back = await until(
            async () => (await child.evaluate(seen)) === (await parentWindow?.evaluate(slot)),
            3000
        );
        check("the parent's window brought back brings the region back", back, await child.evaluate(seen));

        // The owner of an interface whose page loads again by itself ends its connections: the user's onConnect
        // cleanup runs, and the owner's next run connects again.
        const screens = Number(await mark(user, 'screens'));
        await screen?.evaluate('location.reload()');
        const cleaned = await until(async () => (await mark(user, 'cleaned')) === '1', 4000);
        check(
            "an owner that ends calls the cleanup its user's onConnect answered",
            cleaned,
            await mark(user, 'cleaned')
        );
        const reconnected = await until(
            async () =>
                (await mark(user, 'screens')) === String(screens + 1) &&
                (await mark(screen, 'connected')) === 'broker-user',
            6000
        );
        check('an owner that runs again connects again', reconnected, await mark(user, 'screens'));

        // A mod's page loading again by itself ends its run: a mod that uses an interface it owns runs on, as a child
        // in a region does as its parent runs again, and the owner of an interface it used hears its connection end. A
        // mod restarted from Settings runs again, in a new document.
        const started = `performance.timeOrigin`;
        const origin = await user?.evaluate(started);
        const childOrigin = await child.evaluate(started);
        await provider?.evaluate('location.reload()');
        await parent.evaluate('location.reload()');
        await sleep(1500);
        check("a mod whose interface's owner ran again runs on", (await user?.evaluate(started)) === origin, '');
        check('a child whose parent ran again runs on', (await child.evaluate(started)) === childOrigin, '');
        await user?.evaluate('location.reload()');
        const disconnected = await until(async () => (await mark(screen, 'disconnected')) === 'broker-user true', 3000);
        check(
            "a user that ends is heard by its owner's disconnect, with the connection its connect was given",
            disconnected,
            await mark(screen, 'disconnected')
        );
        const providerOrigin = await (await page('deckit://broker-provider.mod'))?.evaluate(started);
        await settings?.evaluate(`${rowOf('Broker Provider')}.querySelector('[title^="Restart this mod"]').click()`);
        const relaunched = await until(async () => {
            const now = await (await page('deckit://broker-provider.mod'))?.evaluate(started);
            return typeof now === 'number' && now !== providerOrigin;
        }, 6000);
        check('a mod restarted from Settings runs again, in a new document', relaunched, '');

        // A main process module finds the window its mod's page is shown in while the mod has a window on the desktop,
        // and none once it has none.
        await show('window-probe');
        const probe = await page('deckit://window-probe.mod');
        check('a main process module finds the window its page is shown in, on the desktop', await probeFinds(), '');
        await (await windowOf('window-probe'))?.key('w', 'KeyW', META, 87);
        await until(async () => !(await windowsNow()).some(({ mod }) => mod === 'window-probe'), 3000);
        check(
            'a main process module of a mod with no window finds no window its page is shown in',
            !(await probeFinds()),
            ''
        );
        await show('window-probe');
        const probeWindow = await windowOf('window-probe');
        // A shown mod's next revision installed over it: its page is replaced while the desktop lays it, the new one
        // loads, and the desktop goes on laying it in its region.
        const was = await child.evaluate(started);
        const next = JSON.stringify(path.join(home, '..', NEXT_CHILD));
        await probe.evaluate(`document.dispatchEvent(new CustomEvent('test-install-from', { detail: ${next} }))`);
        await probeWindow.press('#install');
        const installed = await until(
            async () => (await probe.evaluate('document.documentElement.dataset.installed')) || false,
            8000
        );
        check("a mod's next revision installs over it", installed === 'region-child', installed);
        const loaded = await until(async () => {
            const now = await (await page('deckit://region-child.mod'))?.evaluate(started);
            return typeof now === 'number' && now !== was;
        }, 8000);
        check("a shown mod's next revision loads in a page of its own", loaded, '');

        // A folder and a file dragged in from outside the app and dropped on the probe's destination: it hears the drag
        // come and go, then the files by their paths at the point they landed.
        const droppedFiles = [path.join(home, '..', NEXT_CHILD), path.join(home, '..', NEXT_CHILD, 'main.js')].map(
            (file) => fs.realpathSync(file)
        );
        const probeId = (await windowsNow()).find(({ mod }) => mod === 'window-probe')?.content;
        const zone = await probeWindow.evaluate(
            `(() => { const box = document.getElementById('drop').getBoundingClientRect(); return { x: box.left + 10, y: box.top + 10 }; })()`
        );
        await main(`return webkit.sendDrop(${probeId}, ${JSON.stringify({ files: droppedFiles, ...zone })})`);
        const drop = await until(
            async () => (await probe.evaluate('document.documentElement.dataset.dropped')) || false,
            4000
        );
        check(
            'files dropped from outside the app reach a drop destination by their paths',
            (() => {
                const { paths, at } = JSON.parse(drop || '{}');
                // The point lands on a whole pixel of the window, the zone's corner wherever its layout puts it.
                const near = (value) => Math.abs(value - 10) < 1;
                return JSON.stringify(paths) === JSON.stringify(droppedFiles) && near(at?.x) && near(at?.y);
            })(),
            drop
        );
        const targeted = await probe.evaluate('document.documentElement.dataset.targeted');
        check('a drop destination hears a drag of files come over it and go', targeted === 'on off ', targeted);
        await show('region-parent');
        const relaid = await until(async () => {
            const fresh = await page('deckit://region-child.mod');
            return (await fresh?.evaluate(seen)) === (await (await windowOf('region-parent'))?.evaluate(slot));
        }, 4000);
        check('the desktop lays the new page in its region', relaid, `${await keyMod()} key`);

        // The desktop's page is loaded again once its renderer crashes, and what its console says as an error is
        // logged under its name.
        const desktopNow = `performance.timeOrigin + ':' + document.querySelectorAll('.deckit-dock-item').length`;
        const crashed = await desktop.evaluate(desktopNow);
        await desktop.crash();
        const reloaded = await until(async () => {
            const now = await (await page('deckit://desktop'))?.evaluate(desktopNow);
            return typeof now === 'string' && now !== crashed && now.endsWith(':' + (APPS + TEST_APPS));
        }, 8000);
        check("a crashed desktop's page is loaded again with the Dock", reloaded, crashed);
        // Its backdrop and each window's frame and buttons are opened again, once: the crashed page's are closed.
        const surfacesOpen = async () => {
            const names = [];
            for (const surface of await pages('about:blank')) names.push(await surface.evaluate('window.name'));
            return names.filter((name) => /^(backdrop|frame-\d+|buttons-\d+)$/.test(name));
        };
        const once = async () => {
            const names = await surfacesOpen();
            const windows = (await windowsNow()).length;
            return (
                windows > 3 &&
                new Set(names).size === names.length &&
                names.includes('backdrop') &&
                names.filter((name) => name.startsWith('frame-')).length === windows
            );
        };
        check(
            "a crashed desktop's page opens its backdrop and each window's frame and buttons again, once",
            await until(once, 4000),
            JSON.stringify(await surfacesOpen())
        );
        // Under and over the windows: the backdrop under them, the desktop's page over them.
        const surfacesLaid = async () => {
            const names = namesOf(await stackNow());
            const first = names.findIndex((name) => /^frame-/.test(name));
            const desktopAt = names.findIndex((name) => name.startsWith('deckit://desktop'));
            return (
                first > 0 &&
                names.indexOf('backdrop') < first &&
                desktopAt > names.findLastIndex((name) => /^buttons-/.test(name))
            );
        };
        check(
            "a crashed desktop's page lays its backdrop under the windows and itself over them",
            await until(surfacesLaid, 4000),
            JSON.stringify(namesOf(await stackNow()))
        );
        // Loaded again from main, as a host app may: the new document lays its surfaces as the first did, drawn anew.
        const backdropDrawn = async () => {
            for (const surface of await pages('about:blank'))
                if ((await surface.evaluate('window.name')) === 'backdrop')
                    return surface.evaluate('document.head.children.length + ":" + document.body.innerHTML.length');
        };
        const drawnBefore = await backdropDrawn();
        const beforeReload = await (await page('deckit://desktop'))?.evaluate(desktopNow);
        await (await page('deckit://desktop'))?.reload();
        const reloadedAgain = await until(async () => {
            const now = await (await page('deckit://desktop'))?.evaluate(desktopNow);
            return typeof now === 'string' && now !== beforeReload && now.endsWith(':' + (APPS + TEST_APPS));
        }, 8000);
        check("a desktop's page loaded again draws the Dock", reloadedAgain, beforeReload);
        check(
            "a desktop's page loaded again lays its backdrop and the windows' frames again",
            (await until(surfacesLaid, 4000)) && (await until(once, 4000)),
            JSON.stringify(namesOf(await stackNow()))
        );
        const drawnAgain = await until(async () => (await backdropDrawn()) === drawnBefore, 3000);
        check(
            "a desktop's page loaded again draws its backdrop once, as before",
            drawnAgain,
            `${drawnBefore} -> ${await backdropDrawn()}`
        );
        await (await page('deckit://desktop'))?.evaluate(`console.error('desktop-probe')`, 'deckit');
        const named = await until(() => /desktop: desktop-probe/.test(logged()), 3000);
        check("a shell page's console errors are logged under its name", named, '');
        check(
            'the log says which deckit runs, and that its core started',
            /deckit \d+\.\d+\.\d+ \(sources [0-9a-f]+\)/.test(logged()) && /core: started, pid \d+/.test(logged()),
            ''
        );
    } catch (error) {
        check('scenario ran', false, error.stack);
    }
    check('no page threw', !thrown.length, thrown.slice(0, 3).join(' | '));

    // A core that ends is not started again: what it ended of is told, asking for the app to be restarted.
    try {
        endCore();
        const told = await until(() => /deckit's core ended \(.+\): restart the app/.test(logged()), 5000);
        check('a core that ends asks for the app to be restarted', told, '');
        const notice = `(() => { const down = document.querySelector('.deckit-desktop-down'); return down && !down.hidden ? down.textContent : ''; })()`;
        const asked = await until(
            async () => /needs a restart/.test((await (await page('deckit://desktop'))?.evaluate(notice)) || ''),
            3000
        );
        check("the desktop's page asks the person to restart once the core is down", asked, '');
        await (await page('deckit://desktop'))?.shot('desktop-down');
    } catch (error) {
        check('the core was ended', false, error.stack);
    }
    return report;
}

module.exports = { seed, run };
