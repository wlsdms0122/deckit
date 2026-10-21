// What the test does to Deckit.app, as a person would, and what it checks along the way. Each check is a name, whether
// it held, and what was seen.
const fs = require('fs');
const path = require('path');
const { until, sleep, CTRL, META, SHIFT } = require('./devtools.js');

// The mods Deckit.app ships with a view: every one but Deckit, which is commands only.
const VIEWS = 7;
// The test's own mods with a view: the region parent and the window probe. Its region child is in no list.
const TEST_VIEWS = 2;
const LINES = 'lines.txt';
const FOUND = 'source/quick-open-target.js';
const BROKEN = 'opens-everything';
// Where the region child's next revision is, which the window probe installs over the one there.
const NEXT_CHILD = 'region-child-next';
// A mod removed with its data whose web sessions were not cleared then, so what deck keeps of it is erased at start.
const REMOVED = 'removed-with-data';

// A folder of files the Editor comes back to with LINES open, as a session it saved: an Open dialog cannot be driven.
// The test's own mods, installed, one of them naming schemes it may not, Settings placed second, as a person would
// have arranged it, and what REMOVED left.
function seed({ data, files }) {
    const mods = path.join(data, 'deckit', 'mods');
    fs.cpSync(path.join(__dirname, 'mods'), mods, { recursive: true });
    const next = path.join(data, NEXT_CHILD);
    fs.cpSync(path.join(__dirname, 'mods', 'region-child'), next, { recursive: true });
    fs.appendFileSync(path.join(next, 'main.js'), '// The next revision.\n');
    fs.mkdirSync(path.join(mods, BROKEN), { recursive: true });
    fs.writeFileSync(
        path.join(mods, BROKEN, 'manifest.toml'),
        `id = "${BROKEN}"\nversion = "1.0.0"\napi = "1.0.0"\nmain = "main.js"\nurl-schemes = ["*", "https"]\n`
    );
    fs.writeFileSync(path.join(mods, BROKEN, 'main.js'), 'module.exports = { start() {} };\n');
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
    fs.mkdirSync(path.join(data, 'deckit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(data, 'deckit', 'state', 'mod-order.json'), JSON.stringify(['editor', 'settings']));
    fs.writeFileSync(path.join(data, 'deckit', 'state', 'uncleared.json'), JSON.stringify([REMOVED]));
    for (const kept of [
        ['records', REMOVED, 'tabs.json'],
        ['settings', `${REMOVED}.json`],
        ['data', REMOVED, 'a.txt'],
    ]) {
        fs.mkdirSync(path.dirname(path.join(data, 'deckit', ...kept)), { recursive: true });
        fs.writeFileSync(path.join(data, 'deckit', ...kept), '{}');
    }
}

// `endCore()` kills the app's core, as a crash would; `logged()` is the app's log so far; `home` the app's folder.
async function run({ page, pages, compose, targets, thrown, endCore, logged, home }) {
    const report = [];
    const check = (name, ok, detail = '') => report.push({ name, ok: !!ok, detail: String(detail ?? '') });
    // What main says is on screen, as the panel's frame shows it: the selected row of the mods' list.
    const current = async () =>
        (await page('deckit://panel'))?.evaluate(
            `document.querySelector('[data-mod-id][aria-selected="true"]')?.dataset.modId`
        );
    const visibility = async (id) => ((await current()) === id ? 'visible' : 'hidden');
    // The pages laid with the panel's frame, bottom to top, as a main process module of the window probe's finds
    // them: { url, shown, width } each; and whether it finds the window its own page is shown in.
    const stackNow = async () => {
        const probe = await page('deckit://window-probe.mod');
        await probe?.evaluate(
            `delete document.documentElement.dataset.stack; document.dispatchEvent(new CustomEvent('test-stack'))`
        );
        const read = async () => {
            const written = await probe?.evaluate('document.documentElement.dataset.stack');
            return typeof written === 'string' ? JSON.parse(written) : undefined;
        };
        const stack = (await until(async () => (await read()) || false, 4000)) || [];
        stack.found = (await probe?.evaluate('document.documentElement.dataset.found')) === 'true';
        return stack;
    };
    const urlsOf = (stack) => (Array.isArray(stack) ? stack.map(({ url }) => url.replace(/\/$/, '')) : []);

    // The panel's window as a person sees it, its pages laid one over another from the bottom: the window's own page,
    // the backdrop, the mod on screen and the frame. The width's handle is left out.
    const panelShot = async (name, id) => {
        const backdrop = await until(async () => {
            for (const surface of await pages('about:blank'))
                if ((await surface.evaluate('innerWidth')) > 100) return surface;
        }, 2000);
        const layers = [await page('data:'), backdrop, await page(`deckit://${id}.mod`), await page('deckit://panel')];
        if (layers.every(Boolean))
            await compose(
                name,
                layers.map((session) => ({ session }))
            );
    };

    await sleep(9000);
    for (const target of await targets()) if (target.url.startsWith('deckit://')) await page(target.url);
    try {
        const editor = await page('deckit://editor.mod');
        const frame = await page('deckit://panel');
        check('editor view up', editor);
        check('editor visible first', (await visibility('editor')) === 'visible', await visibility('editor'));
        const rows = await frame.evaluate(
            `[...document.querySelectorAll('[data-mod-id]')].map((row) => row.dataset.modId)`
        );
        // The shipped views and the test's own, the region parent and the window probe: the region child is in no list.
        check(
            `nav lists ${VIEWS + TEST_VIEWS} mods`,
            Array.isArray(rows) && rows.length === VIEWS + TEST_VIEWS,
            JSON.stringify(rows)
        );
        check('the order kept is read back from the core', rows?.[1] === 'settings', JSON.stringify(rows));
        // The test's region parent has no icon.
        const heights = await frame.evaluate(
            `[...new Set([...document.querySelectorAll('[data-mod-id]')].map((row) => row.offsetHeight))].join()`
        );
        check('a mod with no icon has a row as tall as the others', !String(heights).includes(','), heights);
        check(
            "the list is the frame's alone",
            !(await editor.evaluate(`document.querySelectorAll('[data-mod-id]').length`)),
            ''
        );

        // The list is one, so where it is scrolled stays as the mod on screen changes.
        const list = `document.querySelector('.deckit-sidebar-nav .deckit-section-body')`;
        await frame.evaluate(`document.querySelector('.deckit-sidebar-nav').style.height = '90px'`);
        await frame.evaluate(`${list}.scrollTop = 30`);
        const scrolled = await frame.evaluate(`${list}.scrollTop`);
        // Back by its key: the row of a mod scrolled out of sight is not pressed.
        await frame.press('[data-mod-id="note"]');
        await until(async () => (await visibility('note')) === 'visible', 3000);
        await (await page('deckit://note.mod')).key('[', 'BracketLeft', CTRL | META, 219);
        await until(async () => (await visibility('editor')) === 'visible', 3000);
        const kept = await frame.evaluate(`${list}.scrollTop`);
        const returned = await visibility('editor');
        check(
            'the list keeps its scroll as the mod changes',
            scrolled > 0 && kept === scrolled && returned === 'visible',
            `${scrolled} -> ${kept}, editor ${returned}`
        );
        await frame.evaluate(`document.querySelector('.deckit-sidebar-nav').style.height = ''`);

        await frame.press('[data-mod-id="finder"]');
        await sleep(600);
        check('picking Finder shows it', (await visibility('finder')) === 'visible', await visibility('finder'));
        check('picking Finder hides Editor', (await visibility('editor')) === 'hidden', await visibility('editor'));

        const finder = await page('deckit://finder.mod');
        await finder.key('[', 'BracketLeft', CTRL | META, 219);
        await sleep(600);
        check('back key returns to Editor', (await visibility('editor')) === 'visible', await visibility('editor'));

        await editor.key('g', 'KeyG', META | SHIFT, 71);
        const switcher = await until(() => page('deckit://switcher'));
        await until(async () => /Notes/.test((await switcher?.evaluate('document.body.innerText')) || ''));
        check('switcher opens on its chord', switcher);
        if (switcher) {
            const items = await switcher.evaluate(`document.body.innerText`);
            check('switcher lists mods', /Notes/.test(items || ''), String(items).slice(0, 200));
            await switcher.shot('switcher');
            const activeLabel = `document.querySelector('[data-active] .deckit-switcher-label')?.textContent`;
            const first = await switcher.evaluate(activeLabel);
            await switcher.key('ArrowDown', 'ArrowDown', 0, 40);
            await sleep(200);
            const second = await switcher.evaluate(activeLabel);
            await switcher.key('ArrowUp', 'ArrowUp', 0, 38);
            await sleep(200);
            check(
                'arrows move the active row',
                first && second && first !== second && (await switcher.evaluate(activeLabel)) === first,
                `${first} -> ${second}`
            );
            await switcher.type('Open Notes');
            await sleep(1200);
            await switcher.shot('switcher-typed');
            await switcher.key('Enter', 'Enter', 0, 13);
            await until(async () => (await visibility('note')) === 'visible', 4000);
            check('switcher opens Notes', (await visibility('note')) === 'visible', await visibility('note'));
        }

        const note = await page('deckit://note.mod');
        const room = `(() => { const box = (part) => Math.round(document.querySelector(part).getBoundingClientRect()[part === '.deckit-view-content' ? 'x' : 'width']); return box('.deckit-view-content') + ',' + box('.deckit-view-slot'); })()`;
        const open = await note?.evaluate(room);
        // Where the content's title bar area starts: past the window's buttons once nothing else is there.
        const barStart = `document.documentElement.style.getPropertyValue('--deckit-title-bar-area-x')`;
        const barOpen = await note?.evaluate(barStart);
        await note?.key('\\', 'Backslash', META, 220);
        await sleep(700);
        const cardWidth = `document.querySelector('.deckit-sidebar')?.style.width || 'no card'`;
        const collapsed = await frame.evaluate(cardWidth);
        check('toggle sidebar key folds it', collapsed === '0px', collapsed);
        const folded = await note?.evaluate(room);
        check(
            "folding takes the mod's sidebar away and widens its content",
            folded === '0,0' && open !== folded,
            `${open} -> ${folded}`
        );
        const barFolded = await note?.evaluate(barStart);
        check(
            "folded, the content's title bar starts past the window's buttons",
            barOpen === '0px' && parseFloat(barFolded) > 0,
            `${barOpen} -> ${barFolded}`
        );
        await note?.key('\\', 'Backslash', META, 220);
        await sleep(700);
        check('unfolding lays them back', (await note?.evaluate(room)) === open, await note?.evaluate(room));
        const frameKept = path.join(home, 'state', 'host', 'panel-frame.json');
        const sidebarKept = await until(() => fs.existsSync(frameKept), 2000);
        check("the shell's state is kept by the core", sidebarKept, frameKept);
        const notesKept = path.join(home, 'data', 'note');
        const notesMade = await until(() => fs.existsSync(notesKept), 3000);
        check("a main process module keeps what it keeps in its mod's data folder", notesMade, notesKept);
        const left = () =>
            [`records/${REMOVED}`, `data/${REMOVED}`, `settings/${REMOVED}.json`].filter((kept) =>
                fs.existsSync(path.join(home, kept))
            );
        const uncleared = () => fs.readFileSync(path.join(home, 'state', 'uncleared.json'), 'utf8');
        const erased = await until(() => !left().length && uncleared() === '[]', 4000);
        check('what a mod removed with its data left is erased at start', erased, `${left()} ${uncleared()}`);
        await note?.shot('note');
        check(
            'nothing is left floating in a view',
            !(await note?.evaluate(`document.querySelectorAll('.deckit-surface').length`)),
            await note?.evaluate(
                `[...document.querySelectorAll('body > *')].map((element) => element.className + ':' + getComputedStyle(element).backgroundColor).join(' | ')`
            )
        );
        await frame.press('[data-mod-id="settings"]');
        await sleep(1200);
        const settings = await page('deckit://settings.mod');
        // The rows come after the sections, once the list of mods is read.
        const versions = /Editor[\s\S]*1\.0\.0/;
        await until(async () => versions.test((await settings?.evaluate('document.body.innerText')) || ''), 4000);
        const text = (await settings?.evaluate('document.body.innerText')) || '';
        check(
            'settings shows its sections',
            ['Mods', 'Mod Settings', 'URL Schemes', 'Keyboard'].every((word) => text.includes(word)),
            text.slice(0, 400)
        );
        check('settings lists the mods with versions', versions.test(text), '');
        check(
            "a mod's url-schemes are judged by the core",
            text.includes('"*" already takes every scheme'),
            text.slice(text.indexOf(BROKEN) - 100, text.indexOf(BROKEN) + 200)
        );
        await settings?.shot('settings');

        // The overlay: a select opens its menu, keys move and pick, Escape and a press outside put a menu away.
        const menus = `document.querySelectorAll('.deckit-menu[data-state="open"]').length`;
        const firstSelect = `document.querySelector('.deckit-select')`;
        const before = await settings?.evaluate(`${firstSelect}?.textContent`);
        // Scrolled first and clicked a frame later: a scroll that lands after a menu opened puts it away.
        await settings?.evaluate(`${firstSelect}.scrollIntoView()`);
        await sleep(200);
        await settings?.evaluate(`${firstSelect}.click()`);
        const opened = await until(() => settings.evaluate(menus), 2000);
        check(
            'a select opens its menu',
            opened === 1,
            `${before} ${opened} ${await settings.evaluate(`[...document.querySelectorAll('.deckit-menu')].map((m) => m.dataset.state + m.className).join()`)}`
        );
        await settings?.key('ArrowDown', 'ArrowDown', 0, 40);
        await settings?.key('Enter', 'Enter', 0, 13);
        await sleep(400);
        const after = await settings?.evaluate(`${firstSelect}?.textContent`);
        check(
            'the keys pick from it and close it',
            after !== before && !(await settings.evaluate(menus)),
            `${before} -> ${after}`
        );
        const settingsFolder = path.join(home, 'settings');
        const settingKept = await until(
            () => fs.existsSync(settingsFolder) && fs.readdirSync(settingsFolder).length,
            2000
        );
        check('a setting set is kept by the core', settingKept, '');
        await settings?.evaluate(`${firstSelect}.click()`);
        await until(() => settings.evaluate(menus), 2000);
        const floated = await stackNow();
        check(
            "a mod's menu draws over the frame and its handle",
            urlsOf(floated).at(-1) === 'deckit://settings.mod' && floated.at(-1).shown !== false,
            urlsOf(floated)
        );
        await settings?.key('Escape', 'Escape', 0, 27);
        await sleep(400);
        check('Escape puts a menu away', !(await settings.evaluate(menus)), '');
        const settled = await stackNow();
        check('a main process module finds the window its page is shown in, in the panel', settled.found, settled);
        check(
            'the backdrop is at the bottom, and the frame and its handle on top',
            urlsOf(settled)[0] === 'about:blank' &&
                JSON.stringify(urlsOf(settled).slice(-2)) === '["deckit://panel","about:blank"]',
            urlsOf(settled)
        );
        await settings?.evaluate(`${firstSelect}.click()`);
        await until(() => settings.evaluate(menus), 2000);
        await settings?.evaluate(
            `document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))`
        );
        await sleep(400);
        check('a press outside puts a menu away', !(await settings.evaluate(menus)), '');
        const browser = await page('deckit://browser.mod');
        const webview = await browser?.evaluate(`document.querySelector('webview')?.getAttribute('partition')`);
        check('browser web page is in its own session', /:browser:web$/.test(webview || ''), webview);
        const stolen = await editor.evaluate(`new Promise((resolve) => {
            const page = document.createElement('webview');
            page.setAttribute('partition', 'persist:deckit:browser:web');
            page.src = 'https://example.com';
            page.addEventListener('dom-ready', () => resolve('attached'));
            setTimeout(() => resolve(document.contains(page) && page.getWebContentsId ? 'element only' : 'refused'), 2500);
            document.body.appendChild(page);
        })`);
        check("a mod cannot open another mod's session", stolen !== 'attached', stolen);
        const drawn = await frame.evaluate(
            `[...document.querySelectorAll('[data-mod-id] svg')].filter((svg) => svg.children.length).length`
        );
        check("every mod's icon is drawn in the frame", drawn === VIEWS, drawn);
        const backTip = `(() => { const button = document.querySelector('.deckit-sidebar-nav button[title^="Back"]'); button.dispatchEvent(new PointerEvent('pointerenter')); return button.title; })()`;
        const tip = await frame.evaluate(backTip);
        check('the Back button names its chord', /^Back \(.+\)$/.test(tip || ''), tip);
        const ran = await editor.evaluate(`new Promise((resolve) => {
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
        const notices = await editor.evaluate(
            `navigator.permissions.query({ name: 'notifications' }).then((status) => status.state)`
        );
        check("a mod's page gets no web permission", notices === 'denied', notices);
        await editor.evaluate(`location.href = 'deckit://finder.mod/'`);
        await sleep(1500);
        const stayed = (await targets()).filter((target) => target.url.startsWith('deckit://finder.mod')).length;
        check("a mod's view cannot move to another mod's origin", stayed === 1, stayed + ' finder pages');
        await editor.key('g', 'KeyG', META | SHIFT, 71);
        const again = await page('deckit://switcher');
        const listed = await until(
            async () => /Open Folder/.test((await again?.evaluate('document.body.innerText')) || ''),
            5000
        );
        check('a refused navigation leaves the page its commands', listed, '');
        await again?.key('Escape', 'Escape', 0, 27);
        await frame.press('[data-mod-id="editor"]');
        await until(async () => (await visibility('editor')) === 'visible', 3000);
        const activeLine = `document.querySelector('.cm-focused .cm-activeLine')?.textContent`;
        await until(async () => (await editor.evaluate(activeLine)) === 'line 1', 4000);
        await editor.key('l', 'KeyL', META, 76);
        const lineField = await until(() => editor.evaluate(`!!document.querySelector('.deckit-quick-pick-field')`));
        check('Go to Line opens as a panel', lineField, '');
        await editor.type('12');
        await sleep(200);
        await editor.shot('go-to-line');
        await editor.key('Enter', 'Enter', 0, 13);
        await until(async () => (await editor.evaluate(activeLine)) === 'line 12', 2000);
        check(
            'Go to Line moves the cursor',
            (await editor.evaluate(activeLine)) === 'line 12',
            await editor.evaluate(activeLine)
        );
        await editor.key('p', 'KeyP', META, 80);
        await until(() => editor.evaluate(`!!document.querySelector('.deckit-quick-pick-field')`));
        await editor.type('target');
        const names = `[...document.querySelectorAll('.editor-quick-open-name')].map((name) => name.textContent).join()`;
        const found = await until(async () => /quick-open-target\.js/.test((await editor.evaluate(names)) || ''), 4000);
        await editor.shot('open-quickly');
        check(
            'Open Quickly finds a file by part of its name',
            found,
            await editor.evaluate(`document.querySelector('.deckit-quick-pick-message')?.textContent`)
        );
        await editor.key('Escape', 'Escape', 0, 27);
        // Every mod's screen, drawn: what the test does not drive is still seen.
        for (const id of ['editor', 'finder', 'browser', 'note']) {
            await frame.press(`[data-mod-id="${id}"]`);
            await until(async () => (await visibility(id)) === 'visible', 3000);
            await sleep(800);
            await (await page(`deckit://${id}.mod`))?.shot('screen-' + id);
            await panelShot('panel-' + id, id);
        }

        // What mods give each other, judged by the core: a call into what one exports, a point another extends, an
        // event one sends.
        const provider = await page('deckit://broker-provider.mod');
        const user = await page('deckit://broker-user.mod');
        const mark = (session, name) => session?.evaluate(`document.documentElement.dataset.${name}`);
        const asked = await until(async () => (await mark(user, 'asked')) === '42 broker-user', 4000);
        check('a call reaches what a mod requires exports, which hears who called', asked, await mark(user, 'asked'));
        const extended = await until(async () => (await mark(provider, 'extended')) === 'hello provider', 4000);
        check("a point's mod calls what extends it", extended, await mark(provider, 'extended'));
        const pinged = await until(async () => (await mark(user, 'pinged')) === '7', 4000);
        check('an event reaches the mod that listens to it', pinged, await mark(user, 'pinged'));

        // Keys, as the core resolves them: a mod's key that works everywhere, bound again, and a chord recorded.
        const keys = await page('deckit://keys-user.mod');
        await editor.key('9', 'Digit9', META | SHIFT, 57);
        const pressed = await until(async () => (await mark(keys, 'pressed')) === '1', 3000);
        check("a mod's global key runs from another mod's page", pressed, await mark(keys, 'pressed'));
        await keys.evaluate(`document.dispatchEvent(new CustomEvent('test-bind', { detail: 'mod+shift+8' }))`);
        const rebound = await until(async () => /8/.test((await mark(keys, 'chord')) || ''), 3000);
        await editor.key('8', 'Digit8', META | SHIFT, 56);
        const moved = await until(async () => (await mark(keys, 'pressed')) === '2', 3000);
        check('a key bound again runs on its new chord', rebound && moved, await mark(keys, 'chord'));
        await keys.evaluate(`document.dispatchEvent(new CustomEvent('test-record'))`);
        await editor.key('k', 'KeyK', META, 75);
        const recorded = await until(async () => (await mark(keys, 'recorded')) === '{"spec":"cmd+k"}', 3000);
        check('a chord typed to be bound is recorded', recorded, await mark(keys, 'recorded'));

        // Addresses and queries, as the core routes them: an address of a mod's scheme reaches it, and what the mod
        // resolves is in the switcher and runs.
        const opener = await page('deckit://open-user.mod');
        await opener.evaluate(`document.dispatchEvent(new CustomEvent('test-open', { detail: ' TEST-OPEN:hello ' }))`);
        const reached = await until(
            async () =>
                (await mark(opener, 'opened')) === 'TEST-OPEN:hello' && (await mark(opener, 'answered')) === 'true',
            3000
        );
        check("an address of a mod's scheme reaches it", reached, await mark(opener, 'opened'));
        await editor.key('g', 'KeyG', META | SHIFT, 71);
        const query = await until(() => page('deckit://switcher'));
        await until(async () => /Notes/.test((await query?.evaluate('document.body.innerText')) || ''));
        await query?.type('probe open user');
        const resolved = await until(
            async () => /Open User Probe/.test((await query?.evaluate('document.body.innerText')) || ''),
            4000
        );
        await query?.key('Enter', 'Enter', 0, 13);
        const picked = await until(async () => (await mark(opener, 'ran')) === '1', 3000);
        check('what a mod resolves is in the switcher and runs', resolved && picked, `${resolved} ${picked}`);

        // A region in the parent's sidebar: the child is laid over it, and goes as the sidebar folds.
        await frame.press('[data-mod-id="region-parent"]');
        await until(async () => (await visibility('region-parent')) === 'visible', 3000);
        const parent = await page('deckit://region-parent.mod');
        const child = await page('deckit://region-child.mod');
        const slot = `(() => { const r = document.getElementById('region-slot').getBoundingClientRect(); return [r.width, r.height].map(Math.round).join('x'); })()`;
        const seen = `document.documentElement.dataset.shown === 'yes' ? innerWidth + 'x' + innerHeight : 'hidden'`;
        const laid = await until(async () => (await child.evaluate(seen)) === (await parent.evaluate(slot)), 3000);
        check('a region in the sidebar lays its child over it', laid, await child.evaluate(seen));
        const regions = urlsOf(await stackNow());
        check(
            "a child shown in a region is over its parent's page",
            regions.indexOf('deckit://region-child.mod') > regions.indexOf('deckit://region-parent.mod'),
            regions
        );
        await parent.key('\\', 'Backslash', META, 220);
        const gone = await until(async () => (await child.evaluate(seen)) === 'hidden', 3000);
        check('folding the sidebar takes its region away', gone, await child.evaluate(seen));
        await parent.key('\\', 'Backslash', META, 220);
        const back = await until(async () => (await child.evaluate(seen)) === (await parent.evaluate(slot)), 3000);
        check('unfolding the sidebar brings the region back', back, await child.evaluate(seen));

        // A mod runs again once what it requires runs again: the parent's page loading again by itself ends the child's
        // run, and the child launches again in a new document.
        const started = `performance.timeOrigin`;
        const origin = await child.evaluate(started);
        await parent.evaluate('location.reload()');
        const relaunched = await until(async () => (await child.evaluate(started)) !== origin, 6000);
        check('a mod runs again once what it requires runs again', relaunched, '');

        // A shown mod's next revision installed over it: its page is replaced while the panel lays it, the new one
        // loads, and the panel goes on laying it in its region. The probe's row lies past what the frame's page
        // covers on screen, so it is picked as a click in the page.
        await frame.evaluate(`document.querySelector('[data-mod-id="window-probe"]').click()`);
        await until(async () => (await visibility('window-probe')) === 'visible', 3000);
        const probe = await page('deckit://window-probe.mod');
        const was = await child.evaluate(started);
        const next = JSON.stringify(path.join(home, '..', NEXT_CHILD));
        await probe.evaluate(`document.dispatchEvent(new CustomEvent('test-install-from', { detail: ${next} }))`);
        await probe.press('#install');
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
        await frame.evaluate(`document.querySelector('[data-mod-id="region-parent"]').click()`);
        const relaid = await until(async () => {
            const fresh = await page('deckit://region-child.mod');
            return (await fresh?.evaluate(seen)) === (await parent.evaluate(slot));
        }, 4000);
        check('the panel lays the new page in its region', relaid, `${await current()}`);

        // The panel's frame is loaded again once its renderer crashes, and what its console says as an error is
        // logged under its name.
        const frameNow = `performance.timeOrigin + ':' + document.querySelectorAll('[data-mod-id]').length`;
        const crashed = await frame.evaluate(frameNow);
        await frame.send('Page.crash');
        const reloaded = await until(async () => {
            const now = await (await page('deckit://panel'))?.evaluate(frameNow);
            return typeof now === 'string' && now !== crashed && now.endsWith(':' + (VIEWS + TEST_VIEWS));
        }, 8000);
        check("a crashed frame is loaded again with the panel's list", reloaded, crashed);
        // Its backdrop is opened again, once: the crashed page's is closed.
        const backdrops = async () => {
            let found = 0;
            for (const surface of await pages('about:blank')) if ((await surface.evaluate('innerWidth')) > 100) found++;
            return found;
        };
        const reopened = await until(async () => (await backdrops()) === 1, 4000);
        check('a crashed frame opens its backdrop again, once', reopened, await backdrops());
        // Under and over the frame: its backdrop at the bottom, its handle on top.
        const surfacesLaid = async () => {
            const urls = urlsOf(await stackNow());
            return urls[0] === 'about:blank' && JSON.stringify(urls.slice(-2)) === '["deckit://panel","about:blank"]';
        };
        check('a crashed frame lays its backdrop and its handle again', await until(surfacesLaid, 4000), '');
        // Loaded again from main, as a host app may: the new document lays its surfaces as the first did, drawn anew.
        const backdropDrawn = async () => {
            for (const surface of await pages('about:blank'))
                if ((await surface.evaluate('innerWidth')) > 100)
                    return surface.evaluate('document.head.children.length + ":" + document.body.innerHTML.length');
        };
        const drawnBefore = await backdropDrawn();
        const beforeReload = await (await page('deckit://panel'))?.evaluate(frameNow);
        await (await page('deckit://panel'))?.send('Page.reload');
        const reloadedAgain = await until(async () => {
            const now = await (await page('deckit://panel'))?.evaluate(frameNow);
            return typeof now === 'string' && now !== beforeReload && now.endsWith(':' + (VIEWS + TEST_VIEWS));
        }, 8000);
        check("a frame loaded again draws the panel's list", reloadedAgain, beforeReload);
        check('a frame loaded again lays its backdrop and its handle again', await until(surfacesLaid, 4000), '');
        const drawnAgain = await until(async () => (await backdropDrawn()) === drawnBefore, 3000);
        check(
            'a frame loaded again draws its backdrop once, as before',
            drawnAgain,
            `${drawnBefore} -> ${await backdropDrawn()}`
        );
        await (await page('deckit://panel'))?.evaluate(`console.error('frame-probe')`);
        const named = await until(() => /panel: frame-probe/.test(logged()), 3000);
        check("a shell page's console errors are logged under its name", named, '');
    } catch (error) {
        check('scenario ran', false, error.stack);
    }
    check('no page threw', !thrown.length, thrown.slice(0, 3).join(' | '));

    // A core that ends is not started again: what it ended of is told, asking for the app to be restarted.
    try {
        endCore();
        const told = await until(() => /deckit's core ended \(.+\): restart the app/.test(logged()), 5000);
        check('a core that ends asks for the app to be restarted', told, '');
        const notice = `(() => { const down = document.querySelector('.deckit-panel-down'); return down && !down.hidden ? down.textContent : ''; })()`;
        const asked = await until(
            async () => /needs a restart/.test((await (await page('deckit://panel'))?.evaluate(notice)) || ''),
            3000
        );
        check('the panel asks the person to restart once the core is down', asked, '');
        await (await page('deckit://panel'))?.shot('panel-down');
    } catch (error) {
        check('the core was ended', false, error.stack);
    }
    return report;
}

module.exports = { seed, run };
