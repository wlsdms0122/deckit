// What the test does to Deckit.app, as a person would, and what it checks along the way. Each check is a name, whether
// it held, and what was seen.
const { until, sleep, CTRL, META, SHIFT } = require('./devtools.js');

// The mods Deckit.app ships with a view: every one but Deckit, which is commands only.
const VIEWS = 7;

async function run({ page, targets, thrown }) {
    const report = [];
    const check = (name, ok, detail = '') => report.push({ name, ok: !!ok, detail: String(detail ?? '') });
    // What main says is on screen, as every mod's frame shows it: the selected row of the mods' list.
    const current = async () =>
        (await page('deckit://editor.mod'))?.evaluate(
            `document.querySelector('[data-mod-id][aria-selected="true"]')?.dataset.modId`
        );
    const visibility = async (id) => ((await current()) === id ? 'visible' : 'hidden');

    await sleep(9000);
    for (const target of await targets()) if (target.url.startsWith('deckit://')) await page(target.url);
    try {
        const editor = await page('deckit://editor.mod');
        check('editor view up', editor);
        check('editor visible first', (await visibility('editor')) === 'visible', await visibility('editor'));
        const rows = await editor.evaluate(
            `[...document.querySelectorAll('[data-mod-id]')].map((row) => row.dataset.modId)`
        );
        check(`nav lists ${VIEWS} mods`, Array.isArray(rows) && rows.length === VIEWS, JSON.stringify(rows));

        await editor.press('[data-mod-id="finder"]');
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
        await note?.key('\\', 'Backslash', META, 220);
        await sleep(700);
        const cardWidth = `document.querySelector('.deckit-sidebar')?.style.width || 'no card'`;
        const collapsed = await note?.evaluate(cardWidth);
        check('toggle sidebar key folds it', collapsed === '0px', collapsed);
        await note?.key('\\', 'Backslash', META, 220);
        await sleep(700);
        await note?.shot('note');
        check(
            'nothing is left floating in a view',
            !(await note?.evaluate(`document.querySelectorAll('.deckit-surface').length`)),
            await note?.evaluate(
                `[...document.querySelectorAll('body > *')].map((element) => element.className + ':' + getComputedStyle(element).backgroundColor).join(' | ')`
            )
        );
        await editor.press('[data-mod-id="settings"]');
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
        await settings?.evaluate(`${firstSelect}.click()`);
        await until(() => settings.evaluate(menus), 2000);
        await settings?.key('Escape', 'Escape', 0, 27);
        await sleep(400);
        check('Escape puts a menu away', !(await settings.evaluate(menus)), '');
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
        const drawn = await editor.evaluate(
            `[...document.querySelectorAll('[data-mod-id] svg')].filter((svg) => svg.children.length).length`
        );
        check("every mod's icon is drawn in another's view", drawn === VIEWS, drawn);
        await editor.evaluate(`(() => {
            const image = document.createElement('img');
            image.setAttribute('onerror', 'window.ranInPage = true');
            image.src = 'deckit://editor.mod/missing';
            document.body.appendChild(image);
        })()`);
        await sleep(1500);
        const ran = await editor.evaluate(`!!window.ranInPage`);
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
        // Every mod's screen, drawn: what the test does not drive is still seen.
        for (const id of ['editor', 'finder', 'browser', 'note']) {
            await editor.press(`[data-mod-id="${id}"]`);
            await until(async () => (await visibility(id)) === 'visible', 3000);
            await sleep(800);
            await (await page(`deckit://${id}.mod`))?.shot('screen-' + id);
        }
    } catch (error) {
        check('scenario ran', false, error.stack);
    }
    check('no page threw', !thrown.length, thrown.slice(0, 3).join(' | '));
    return report;
}

module.exports = { run };
