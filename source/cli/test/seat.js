// The desktop of the app under test as its local seat sees it, read through WebKit's module: the windows and stages
// laid, the pages on them, the Dock, and the desktop drawn as a person sees it.
const { until } = require('./devtools.js');

// What the test reads of a document a page opened beside itself: its name, its opener's address, and whether it draws
// a window's frame as the key window's.
const SURFACE = `return ([window.name, window.opener?.location.href ?? '', !!document.querySelector('.deckit-window-material[data-key]')])`;

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
    // The windows on the desktop, back to front, as the local seat sees them: `{ id, mod, url, rect, key, content }`
    // each, `mod` the mod whose page opened its content, `rect` its content's on the desktop, `key` whether its frame
    // is drawn as the key window's, and `content` the page its content is.
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
    // The desktop as a person sees it, its pages laid one over another from the backdrop up, with `compose`'s options.
    const desktopShot = async (name, options) => {
        const laid = ((await desktopLaid())?.pages || []).filter(({ input }) => !Array.isArray(input) || input.length);
        const from = laid.findIndex(({ name: each }) => each === 'backdrop');
        if (from < 0) return;
        const layers = [];
        for (const { id, rect, clips } of laid.slice(from)) {
            const session = await pageById(id);
            if (session) layers.push({ session, x: rect.x, y: rect.y, clips });
        }
        await compose(name, layers, options);
    };
    return { laidNow, desktopLaid, pageAt, windowsNow, keyMod, windowOf, dockNow, dockClick, show, desktopShot };
}

module.exports = { seat };
