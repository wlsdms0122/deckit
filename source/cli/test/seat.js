// The desktop of the app under test as its local seat sees it, read through WebKit's module: the windows and stages
// laid, the pages on them, the Dock, the Seats mod's item and view, and the desktop drawn as a person sees it.
const { sleep, until } = require('./devtools.js');

// What the test reads of a document a page opened beside itself: its name, its opener's address, and whether it draws
// a window's frame as the key window's.
const SURFACE = `return ([window.name, window.opener?.location.href ?? '', !!document.querySelector('.deckit-window-material[data-key]')])`;

// What the Seats mod's view writes on the two answers of a user that asks (mods/seats).
const ANSWERS = { allow: 'Allow', deny: 'Deny' };

// A line of WebKit's module's `tree`, a view indented under its superview: its type, its frame in its superview,
// whether it is hidden, whether it has its window's keyboard, the radius of the corners it cuts what is in it to, if
// any, whether a layer transform draws it scaled, and the page it shows and the rects of it that take the pointer, if
// one.
function viewOf(line) {
    const match = /^ *(\S+) \{\{([-\d.]+), ([-\d.]+)\}, \{([-\d.]+), ([-\d.]+)\}\}(.*)$/.exec(line);
    if (!match) return null;
    const [x, y, width, height] = match.slice(2, 6).map(Number);
    const page = Number(/ page (\d+)/.exec(match[6])?.[1]) || null;
    const input = / input \[(.*?)\]/.exec(match[6])?.[1].split('|').filter(Boolean).map(rectOf) ?? null;
    const responder = / responder/.test(match[6]);
    const radius = Number(/ radius ([\d.]+)/.exec(match[6])?.[1]) || 0;
    return {
        type: match[1],
        rect: { x, y, width, height },
        hidden: / hidden/.test(match[6]),
        responder,
        radius,
        scaled: / scaled/.test(match[6]),
        page,
        input,
    };
}

// A rect as NSStringFromRect writes it, `{{x, y}, {width, height}}`.
function rectOf(text) {
    const [x, y, width, height] = text.match(/[-\d.]+/g).map(Number);
    return { x, y, width, height };
}

// What reads the desktop through `main`, `pageById` and `compose`, a client's (devtools.js), and `desktop()`, the
// session of the desktop's page.
function seat({ main, pageById, compose, desktop }) {
    // Every window of WebKit's module: its content's size, and its stages from the bottom, each whether it is shown
    // and the pages on it, bottom to top, `{ id, width, height, stages: [{ shown, rect, pages: [{ id, url, name,
    // opener, keyed, rect, clips, hidden, responder, input, scaled }] }] }`, a page's rect on its stage, through the
    // clips it is drawn in, those clips' `{ rect, radius }` on the stage, outermost first, its name, opener and `keyed`
    // those of a document a page opened beside itself (SURFACE), and `scaled` whether it or a clip it is in is drawn
    // scaled.
    const laidNow = async () => {
        const found = await main(`
            const urls = Object.fromEntries(webkit.pages().map((id) => [id, webkit.state(id).url]));
            const named = {};
            for (const [id, url] of Object.entries(urls)) {
                if (url !== 'about:blank') continue;
                try {
                    const told = await webkit.evaluate(Number(id), ${JSON.stringify(SURFACE)}, 'page');
                    named[id] = typeof told === 'string' ? JSON.parse(told) : null;
                } catch {}
            }
            return { windows: webkit.windows().map((id) => ({ id, tree: webkit.tree(id) })), urls, named };`);
        return (found?.windows || []).map(({ id, tree }) => {
            const lines = tree.split('\n');
            const stages = [];
            const origins = []; // by depth, each view's origin on the stage it is in
            const cuts = []; // by depth, the views with rounded corners a view is in, and itself if it is one
            const scaled = []; // by depth, whether a view or one it is in is drawn scaled
            let first = null;
            for (const line of lines) {
                const view = viewOf(line);
                if (!view) continue;
                first ??= view;
                const depth = (line.length - line.trimStart().length) / 2;
                if (view.type === 'StageView') {
                    stages.push({ shown: !view.hidden, rect: view.rect, pages: [], depth });
                    origins[depth] = { x: 0, y: 0 };
                    continue;
                }
                const stage = stages.at(-1);
                const inStage = stage && depth > stage.depth;
                const parent = inStage ? origins[depth - 1] : null;
                const at = parent ? { x: parent.x + view.rect.x, y: parent.y + view.rect.y } : null;
                origins[depth] = at;
                const around = (inStage && cuts[depth - 1]) || [];
                cuts[depth] =
                    view.radius && at ? [...around, { rect: { ...view.rect, ...at }, radius: view.radius }] : around;
                scaled[depth] = view.scaled || (inStage && !!scaled[depth - 1]);
                if (!view.page || !inStage) continue;
                const [name, opener, keyed] = found.named[view.page] || ['', '', false];
                stage.pages.push({
                    id: view.page,
                    url: found.urls[view.page] || '',
                    name,
                    opener,
                    keyed,
                    rect: { ...view.rect, ...at },
                    clips: around,
                    hidden: view.hidden,
                    responder: view.responder,
                    input: view.input,
                    scaled: scaled[depth],
                });
            }
            return { id, width: first?.rect.width, height: first?.rect.height, stages };
        });
    };
    // The host window's desktop: its stage, `{ window, shown, rect, pages, width, height }`, `window` the host window's
    // id, its pages bottom to top, or null.
    const desktopLaid = async () => {
        for (const window of await laidNow())
            for (const stage of window.stages)
                if (stage.pages.some(({ url }) => url.startsWith('deckit://desktop')))
                    return { ...stage, window: window.id, width: window.width, height: window.height };
        return null;
    };
    // The id of the page a press at `point` on the desktop reaches, as the host window hit tests it, through the views
    // laid, their clips and the rects of each that take the pointer, or null where it reaches none.
    const pageAt = async ({ x, y }) => {
        const laid = await desktopLaid();
        if (!laid) return null;
        const at = { x: laid.rect.x + x, y: laid.rect.y + y };
        return main(`return webkit.pageAt(${laid.window}, ${JSON.stringify(at)})`);
    };
    // The windows on the desktop, back to front, as the local seat sees them: `{ id, mod, url, rect, key, content,
    // scaled }` each, `mod` the mod whose page opened its content, `rect` its content's on the desktop, `key` whether
    // its frame is drawn as the key window's, `content` the page its content is, and `scaled` whether it is drawn
    // scaled.
    const windowsNow = async () => {
        const laid = (await desktopLaid())?.pages || [];
        const windows = [];
        laid.forEach((each, at) => {
            const id = /^frame-(\d+)$/.exec(each.name)?.[1];
            const content = laid[at + 1];
            if (!id || !content || content.name === `buttons-${id}`) return;
            const mod = /^deckit:\/\/([^./]+)\.mod/.exec(content.opener)?.[1] ?? null;
            windows.push({
                id: Number(id),
                mod,
                url: content.url,
                rect: content.rect,
                key: each.keyed,
                content: content.id,
                scaled: content.scaled,
            });
        });
        return windows;
    };
    // The mod of the local seat's key window, or null.
    const keyMod = async () => (await windowsNow()).find(({ key }) => key)?.mod ?? null;
    // The session of the content of mod `id`'s front window on the desktop, or null.
    const windowOf = async (id) => {
        const front = (await windowsNow()).filter(({ mod }) => mod === id).at(-1);
        return front ? pageById(front.content) : null;
    };
    // The Dock's items as the desktop's page draws them: `{ id, running, active, attention }` each, in order.
    const dockNow = async () =>
        (await desktop()?.evaluate(`[...document.querySelectorAll('.deckit-dock-item')].map((item) => ({
            id: item.dataset.modId,
            running: item.hasAttribute('data-running'),
            active: item.hasAttribute('data-active'),
            attention: item.hasAttribute('data-attention'),
        }))`)) || [];
    // A click on mod `id`'s Dock item.
    const dockClick = (id) =>
        desktop().evaluate(`document.querySelector('.deckit-dock-item[data-mod-id="${id}"]')?.click()`);
    // The mod `id` brought front from its Dock item, its window the key window.
    const show = async (id) => {
        await dockClick(id);
        await until(async () => (await keyMod()) === id, 3000);
    };
    // The window of the mod `id`, opened from its Dock item where none stands and left a second to settle.
    const open = async (id) => {
        if (!(await windowOf(id))) await dockClick(id);
        await until(async () => !!(await windowOf(id)), 8000);
        await sleep(1000);
        return windowOf(id);
    };
    // The item of the mod `id` pressed in the Mods mod's window, as a person opens a mod the Dock does not keep.
    const openFromMods = async (id) => {
        const mods = await windowOf('mods');
        const item = `document.querySelector('.mods-item[data-mod-id="${id}"]')`;
        await until(() => mods?.evaluate(`!!${item}`), 4000);
        await mods?.evaluate(`${item}.click()`);
    };
    // The desktop as a person sees it, its pages laid one over another from the backdrop up, with `compose`'s options:
    // those that take the pointer somewhere, and the cursors' surface, which takes it nowhere.
    const desktopShot = async (name, options) => {
        const laid = ((await desktopLaid())?.pages || []).filter(
            ({ name: each, input }) => each === 'cursors' || !Array.isArray(input) || input.length
        );
        const from = laid.findIndex(({ name: each }) => each === 'backdrop');
        if (from < 0) return;
        const layers = [];
        for (const { id, rect, clips } of laid.slice(from)) {
            const session = await pageById(id);
            if (session) layers.push({ session, x: rect.x, y: rect.y, clips });
        }
        await compose(name, layers, options);
    };
    // The windows of the mod `mod` the host window lays over the desktop's page, the local seat's screen, as
    // `desktopLaid` has each: one on another seat's screen alone lies under the backdrop and is left out.
    const laidOf = async (mod) => {
        const laid = (await desktopLaid())?.pages ?? [];
        const over = laid.findIndex(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''));
        return laid
            .slice(over + 1)
            .filter(({ opener, name }) => opener?.startsWith(`deckit://${mod}.mod`) && /^deckit-window-/.test(name));
    };
    // The machine's press in the middle of what `selector` finds in the laid page `page`, the local seat's: where
    // it pressed on the stage, or null where nothing is found there.
    const pressIn = async (page, selector) => {
        const session = page && (await pageById(page.id));
        const at = await session?.evaluate(`(() => {
            const part = document.querySelector(${JSON.stringify(selector)});
            if (!part) return null;
            const { x, y, width, height } = part.getBoundingClientRect();
            return { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
        })()`);
        if (!at) return null;
        for (const type of ['down', 'up'])
            await main(`return webkit.sendMouse(${page.id}, ${JSON.stringify({ type, ...at })})`);
        return { x: page.rect.x + at.x, y: page.rect.y + at.y };
    };
    // The Seats mod's item in the status bar as the capsule draws it, `{ name, text, cut, x, y }`, what it is called,
    // what it writes, whether its label is drawn cut short, and its middle on the stage, or null while there is none.
    const seatsItem = async () => {
        const [bar] = await laidOf('status-bar');
        const drawn = await (bar && (await pageById(bar.id)))?.evaluate(`(() => {
            const item = document.querySelector('.status-bar-item[data-item="seats"]');
            if (!item) return null;
            const { x, y, width, height } = item.getBoundingClientRect();
            const name = item.getAttribute('aria-label');
            const label = item.querySelector('.status-bar-label');
            const cut = !!label && label.scrollWidth > label.clientWidth;
            return { name, text: item.textContent, cut, x: x + width / 2, y: y + height / 2 };
        })()`);
        if (!drawn) return null;
        return { ...drawn, x: Math.round(bar.rect.x + drawn.x), y: Math.round(bar.rect.y + drawn.y) };
    };
    // The Seats mod's view on the local seat's screen, as `desktopLaid` has it, shown by the machine's press on the
    // mod's item where it is not there; null where no item stands or the view did not come within `within` ms.
    const seatsShown = async (within = 3000) => {
        const [shown] = await laidOf('seats');
        if (shown) return shown;
        const [bar] = await laidOf('status-bar');
        if (!(await pressIn(bar, '.status-bar-item[data-item="seats"]'))) return null;
        return until(async () => (await laidOf('seats'))[0], within);
    };
    // That view put away where it is on the local seat's screen, by the machine's press on the mod's item, which
    // toggles it: the local seat's keyboard is its key window's again. It is looked for once more after a while, since
    // a view whose item went and came back comes back with it.
    const seatsAway = async () => {
        for (let tries = 0; tries < 3; tries++) {
            if ((await laidOf('seats')).length) {
                const [bar] = await laidOf('status-bar');
                await pressIn(bar, '.status-bar-item[data-item="seats"]');
                await until(async () => !(await laidOf('seats')).length, 3000);
            }
            await sleep(300);
            if (!(await laidOf('seats')).length) return;
        }
    };
    // The rows of the Seats mod's view as it draws them, `{ asks, seats }`: each ask's user's name, and each seat's
    // `{ name, says, colour, idle, following }`; of `view`, a view `seatsShown` answered, read where it stands or not,
    // or of the one shown now, both empty where none is.
    const seatsRows = async (view = null) => {
        const from = view ?? (await seatsShown());
        const rows = await (from && (await pageById(from.id)))?.evaluate(`({
            asks: [...document.querySelectorAll('.seats-ask .seats-name')].map((node) => node.textContent),
            seats: [...document.querySelectorAll('.seats-seat')].map((node) => ({
                name: node.querySelector('.seats-name').textContent,
                says: node.querySelector('.seats-says').textContent,
                colour: node.style.getPropertyValue('--seats-colour'),
                idle: node.hasAttribute('data-idle'),
                following: node.getAttribute('aria-pressed') === 'true',
            })),
        })`);
        return rows || { asks: [], seats: [] };
    };
    // The users that ask to sit, by name, as that view has a row of each; none while the bar has no Seats item. The
    // view is put away again.
    const asksNow = async () => {
        const { asks } = await seatsRows();
        await seatsAway();
        return asks;
    };
    // An answer, 'allow' or 'deny', of the row of the user named `name` that asks, once the view draws it within
    // `within` ms: `{ view, selector }`, the view and what finds the answer's button in it, or null.
    const answerOf = (name, word, within) => {
        const selector = `[data-answer="${word}"][aria-label="${ANSWERS[word]} ${name}"]`;
        return until(async () => {
            const view = await seatsShown();
            const session = view && (await pageById(view.id));
            const drawn = await session?.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
            return drawn ? { view, selector } : null;
        }, within);
    };
    // The machine's press at a point of the desktop's page, the local seat's.
    const pressAt = async (at) => {
        for (const type of ['down', 'up'])
            await main(`return webkit.sendMouse(${desktop().id}, ${JSON.stringify({ type, ...at })})`);
    };
    // What the machine's pointer does at a point of the desktop's page, the local seat's: `type` 'down', 'dragged',
    // a move with the button held, or 'up'.
    const mouseAt = (type, at) => main(`return webkit.sendMouse(${desktop().id}, ${JSON.stringify({ type, ...at })})`);
    // What `script` answers in the desktop's page.
    const inDesktop = (script) => desktop()?.evaluate(script);
    // The local seat's answer to the user named `name`, as the machine presses it in the view, which is put away
    // after: the users that asked as it did, by name, or null where the user did not ask in time.
    const answer = async (name, word, within = 10000) => {
        const found = await answerOf(name, word, within);
        const asking = found && (await seatsRows(found.view)).asks;
        if (found) await pressIn(found.view, found.selector);
        await seatsAway();
        return asking;
    };
    // What `attaching` comes to, the local seat allowing the user named `name` where it is asked.
    const allowed = async (name, attaching) => {
        let over = false;
        const come = Promise.resolve(attaching).finally(() => (over = true));
        come.catch(() => {});
        while (!over) if (await answer(name, 'allow', 300)) break;
        const came = await come;
        await seatsAway();
        return came;
    };
    return {
        laidNow,
        desktopLaid,
        pageAt,
        windowsNow,
        keyMod,
        windowOf,
        dockNow,
        dockClick,
        show,
        open,
        openFromMods,
        desktopShot,
        asksNow,
        answerOf,
        pressAt,
        mouseAt,
        inDesktop,
        answer,
        allowed,
        seatsView: { item: seatsItem, shown: seatsShown, away: seatsAway, rows: seatsRows, pressIn },
    };
}

module.exports = { seat };
