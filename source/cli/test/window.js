// The windows mods open (deckit-shell/shell/window/main), over stand-ins for what connect answers, the shell's pages,
// their overlays, the desktop and the host app: a normal window opened on the desktop at its size, one of a name per
// run, a window opened or ordered front without taking the keyboard and one made key and ordered front, an overlay
// window and a panel window guarded by each one's permission, picked by its level, an overlay one in a floating window
// of the host app's, taking the keyboard only where its mod may activate, and its taking it the local seat's input, the
// mod's page laid in that window under its content until the page has a normal window and again once it has none, the
// children its regions show laid over its content, the content's keys and presses heard and the page told of its
// window, a window closed by its page and with its page, the keyboard of a page going to its key window's content, a
// panel window in the host's bar, never ordered front and pressed as no window made key, one at the right edge, which
// the desktop gives the keyboard as it is ordered front, and a web page's window: on
// the desktop for the mod whose page shows it, titled, with no name, closed however it closes with those who listen
// told once. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, detail) => {
        count += 1;
        if (!ok) failed.push(`${name}: ${JSON.stringify(detail)}`);
    };
    const { createWindows } = await import(url('deckit-shell', 'shell', 'window', 'main.js'));
    const shell = windowsOver(createWindows);
    const { pages, desktop, sent, host } = shell;

    const first = shell.fromPage('open', pages.a, { name: 'main' });
    const opened = desktop.opened.at(-1);
    check(
        'a normal window opens on the desktop at the size its mod gives, or the one a window opens at',
        first.surface === `deckit-window-${first.id}` &&
            opened.level === 'normal' &&
            opened.mod === 'a' &&
            opened.size.width === 720 &&
            opened.size.height === 480 &&
            opened.bar.style === 'unified' &&
            opened.bar.height === 48 &&
            opened.title === '',
        opened
    );
    const again = shell.fromPage('open', pages.a, { name: 'main', width: 300, height: 200 });
    check(
        'a window of a name open in the run is ordered front and answered again',
        again.id === first.id && desktop.opened.length === 1 && desktop.fronted.at(-1)?.activates === true,
        { again, fronted: desktop.fronted }
    );
    shell.fromPage('open', pages.a, { name: 'main', activates: false });
    const quiet = shell.fromPage('open', pages.a, { name: 'quiet', activates: false });
    check(
        'a window opened without activating, or the one of its name ordered front so, leaves the key window where it is',
        desktop.fronted.at(-1)?.key === false &&
            desktop.opened.at(-1).id === quiet.id &&
            desktop.opened.at(-1).activates === false &&
            opened.activates === true,
        { fronted: desktop.fronted.at(-1), opened: desktop.opened.at(-1) }
    );
    shell.fromPage('order-front', pages.a, { id: first.id });
    const ordered = desktop.fronted.at(-1);
    shell.fromPage('make-key-and-order-front', pages.a, { id: first.id });
    const made = desktop.fronted.at(-1);
    check(
        'a window ordered front by its page stays out of the key window, and one made key takes it with the host window',
        ordered.key === false && made.key === true && made.activates === true,
        { ordered, made }
    );
    shell.fromPage('close', pages.a, { id: quiet.id });

    const levels = [{ level: 'overlay' }, { level: 'panel' }, { level: 'normal' }, { level: 'constructor' }];
    const picked = [...levels, { level: 5 }, {}, null, 'overlay'].map(shell.guards['deckit-shell:window-open']);
    check(
        'an overlay window and a panel window are each guarded by its permission, picked by its level, and any other ' +
            'window by none',
        JSON.stringify(picked) === '["system.overlay-windows","deckit.panel-windows",null,null,null,null,null,null]',
        picked
    );

    const content = { name: 'content-a' };
    shell.openSurface(first.surface, content);
    check(
        "the content's keys reach the keys of the app as its page's, and its page is told of its window",
        shell.listenedAs.get(content) === pages.a &&
            sent.some(
                ({ channel, page, payload }) => channel === 'state' && page === pages.a && payload.id === first.id
            ),
        { listened: [...shell.listenedAs], sent }
    );
    shell.focus(content);
    check("a press in the content is the person's on its window", desktop.pressed.at(-1) === first.id, null);
    desktop.key = first.id;
    check(
        "a page's keyboard goes to its key window's content, and a page with none keeps its own",
        shell.windows.keyboardOf(pages.a) === content && shell.windows.keyboardOf(pages.b) === pages.b,
        null
    );
    shell.focus(content);
    check(
        "the key window's content taking the keyboard is no press on its window",
        desktop.pressed.length === 1,
        desktop.pressed
    );

    const float = shell.fromPage('open', pages.b, { name: 'float', level: 'overlay', width: 400, height: 300 });
    const shown = host.shown.at(-1);
    check(
        "an overlay window floats in a window of the host app's, taking the keyboard",
        shown?.control.mod === 'b' && shown.control.width === 400 && shown.activates === true,
        shown
    );
    shell.fromPage('order-front', pages.b, { id: float.id });
    const frontOnly = host.shown.at(-1);
    shell.fromPage('make-key-and-order-front', pages.b, { id: float.id });
    const keyToo = host.shown.at(-1);
    const toast = shell.fromPage('open', pages.b, { name: 'toast', level: 'overlay', activates: false });
    const toastShown = host.shown.at(-1);
    check(
        'an overlay window ordered front, or opened without activating, leaves the keyboard where it is; made key, ' +
            'it takes it',
        frontOnly.activates === false &&
            keyToo.activates === true &&
            toastShown.control.name === 'toast' &&
            toastShown.activates === false,
        { frontOnly, keyToo, toastShown }
    );
    desktop.may.delete('b');
    shell.fromPage('make-key-and-order-front', pages.b, { id: float.id });
    const held = host.shown.at(-1);
    check(
        'an overlay window of a mod that may not activate shows without the keyboard',
        held.activates === false,
        held
    );
    // The keyboard went elsewhere before the shell's asks were answered, and the person presses in the window.
    shown.control.didResignKey();
    shown.control.focus();
    check(
        "an overlay window taking the keyboard is the local seat's input reaching its mod, the active mod's window",
        desktop.inputs.at(-1) === 'local:b' && shell.windows.keyOverlay()?.mod === 'b',
        desktop.inputs
    );
    shown.control.didResignKey();
    const keptBefore = shown.control.keptFrame;
    shown.control.didMove({ x: 40, y: 60, width: 400, height: 300 });
    check(
        'an overlay window carries the frame the desktop kept for it, and each frame the host app tells a move left ' +
            'is kept with the desktop',
        keptBefore === null &&
            JSON.stringify(desktop.frames.get('overlay:b/float')) ===
                JSON.stringify({ x: 40, y: 60, width: 400, height: 300 }) &&
            shown.control.keptFrame?.x === 40,
        { keptBefore, frames: [...desktop.frames] }
    );
    desktop.may.add('b');
    shell.fromPage('close', pages.b, { id: toast.id });
    shown.control.place({ name: 'host-window' });
    const stage = shell.stages.at(-1);
    const floatContent = { name: 'content-b' };
    shell.openSurface(float.surface, floatContent);
    const names = () => stage.laid.map(({ page }) => page.name).join();
    check(
        'the page of a mod with no normal window is laid in its overlay window, under the content',
        names() === 'page-b,content-b' && stage.laid[0].input.length === 0,
        stage.laid
    );
    const normal = shell.fromPage('open', pages.b, { name: 'main' });
    check('the page leaves its overlay window as it opens a normal window', names() === 'content-b', stage.laid);
    shell.fromPage('close', pages.b, { id: normal.id });
    check(
        'the page is back in its overlay window once its last normal window closes, and is told the window closed',
        names() === 'page-b,content-b' &&
            desktop.closed.includes(normal.id) &&
            sent.some(({ channel, payload }) => channel === 'closed' && payload.id === normal.id),
        { laid: stage.laid, sent }
    );
    shell.laidOut.set('c', { window: float.id, rect: { x: 10.4, y: 20, width: 30, height: 40 } });
    desktop.change();
    const child = stage.laid.at(-1);
    check(
        'an overlay window lays the child its region shows over its content, cut to the stage, and shows it there',
        names() === 'page-b,content-b,page-c' &&
            JSON.stringify([child.rect, child.clip]) ===
                JSON.stringify([
                    { x: 10, y: 20, width: 30, height: 40 },
                    { x: 0, y: 0, width: 400, height: 300 },
                ]) &&
            shell.shown.get(stage)?.join() === 'page-c',
        { laid: stage.laid, shown: [...shell.shown] }
    );
    shell.laidOut.clear();
    desktop.change();
    check('an overlay window lays no child its regions show no more', names() === 'page-b,content-b', stage.laid);

    shell.fromPage('close', pages.b, { id: first.id });
    check("a page's word about another page's window is not heard", !desktop.closed.includes(first.id), desktop.closed);

    const site = { name: 'site' };
    shell.webOf.set(site, pages.a);
    const web = shell.windows.openWeb({ title: 'Example', page: site });
    const webWindow = desktop.opened.at(-1);
    check(
        'a web page in a window is a normal window on the desktop of the mod whose page shows it, titled, with no ' +
            'name, 520 by 700, its content the web page',
        webWindow.mod === 'a' &&
            webWindow.page === pages.a &&
            webWindow.surface === site &&
            webWindow.title === 'Example' &&
            webWindow.name === null &&
            webWindow.size.width === 520 &&
            webWindow.size.height === 748 &&
            webWindow.bar.style === 'titled',
        webWindow
    );
    web.setTitle('Example, again');
    check(
        "a web page's window takes the title it is given",
        desktop.titles.at(-1) === 'Example, again',
        desktop.titles
    );
    shell.focus(site);
    check("a press in the web page is the person's on its window", desktop.pressed.at(-1) === webWindow.id, null);
    const sentBefore = sent.length;
    shell.overlayChanged(pages.a);
    desktop.change();
    check(
        "the mod's page is told nothing of a web page's window",
        sent.slice(sentBefore).every(({ payload }) => payload.id !== webWindow.id),
        sent.slice(sentBefore)
    );
    let heard = 0;
    web.on('close', () => (heard += 1));
    web.close();
    web.close();
    check(
        "a web page's window closed tells those who listen once, and neither closes the web page nor tells the page",
        heard === 1 &&
            desktop.closed.includes(webWindow.id) &&
            !shell.pagesClosed.includes(site) &&
            !sent.some(({ channel, payload }) => channel === 'closed' && payload.id === webWindow.id),
        { heard, closed: desktop.closed }
    );
    let strange = null;
    try {
        shell.windows.openWeb({ title: '', page: { name: 'stray' } });
    } catch (error) {
        strange = error;
    }
    check('a page no mod shows opens no window', !!strange, null);

    const webAgain = shell.windows.openWeb({ title: 'Later', page: site });
    let closedWithPage = 0;
    webAgain.on('close', () => (closedWithPage += 1));
    shell.end(pages.a);
    check(
        "a page's windows close with its document, its web pages' windows too",
        desktop.closed.includes(first.id) && closedWithPage === 1 && shell.pagesClosed.includes(content),
        { closed: desktop.closed, closedWithPage }
    );

    const panel = shell.fromPage('open', pages.b, { name: 'bar', level: 'panel', width: 120, height: 30 });
    const inBar = desktop.panels.at(-1);
    const panelContent = { name: 'content-panel' };
    shell.openSurface(panel.surface, panelContent);
    const fronted = desktop.fronted.length;
    shell.fromPage('make-key-and-order-front', pages.b, { id: panel.id });
    shell.fromPage('open', pages.b, { name: 'bar', level: 'panel' });
    shell.focus(panelContent);
    check(
        "a panel window stands in the host's bar, as the desktop places it, ordered front by nothing, and a press in " +
            'it is no press that makes a window key',
        inBar?.id === panel.id &&
            inBar.level === 'panel' &&
            inBar.edge === 'top' &&
            inBar.size.width === 120 &&
            !host.shown.some(({ control }) => control.name === 'bar') &&
            desktop.fronted.length === fronted &&
            desktop.panelPressed.at(-1) === panel.id &&
            !desktop.pressed.includes(panel.id),
        { inBar, panelPressed: desktop.panelPressed }
    );
    shell.fromPage('close', pages.b, { id: panel.id });
    check(
        'a panel window closed leaves the bar',
        desktop.panelsClosed.includes(panel.id) && shell.pagesClosed.includes(panelContent),
        desktop.panelsClosed
    );

    const side = shell.fromPage('open', pages.b, { name: 'side', level: 'panel', edge: 'right', width: 360 });
    const atSide = desktop.panels.at(-1);
    shell.fromPage('make-key-and-order-front', pages.b, { id: side.id });
    shell.fromPage('order-front', pages.b, { id: side.id });
    const normalEdge = shell.fromPage('open', pages.b, { name: 'plain', edge: 'right' });
    check(
        'a panel window at the right edge opens at that edge, and makeKeyAndOrderFront and orderFront ask the desktop ' +
            'to give it the keyboard as an overlay window takes it; a window at another level has no edge',
        atSide?.id === side.id &&
            atSide.edge === 'right' &&
            panel.id !== side.id &&
            JSON.stringify(desktop.panelsFronted) ===
                JSON.stringify([
                    { id: side.id, activates: true },
                    { id: side.id, activates: false },
                ]) &&
            desktop.opened.find(({ id }) => id === normalEdge.id)?.edge === null,
        { atSide, fronted: desktop.panelsFronted }
    );

    const named = [{ id: 'item', rect: { x: 4, y: 2, width: 32, height: 24 }, mod: 'a', more: true }];
    shell.fromPage('set-anchors', pages.b, { id: side.id, anchors: named });
    const kept = desktop.anchors.at(-1);
    shell.fromPage('set-anchors', pages.b, { id: side.id, anchors: [{ id: 'item', rect: {}, mod: 'a' }] });
    shell.fromPage('set-anchors', pages.a, { id: side.id, anchors: [] });
    shell.fromPage('set-anchors', pages.b, { id: float.id, anchors: named });
    check(
        "the rects a window's mod names in its content are the desktop's to keep, as an id, a rect and a mod each: " +
            "not those of another shape, of another page's window or of an overlay window",
        desktop.anchors.length === 1 &&
            kept.id === side.id &&
            JSON.stringify(kept.anchors) ===
                JSON.stringify([{ id: 'item', rect: { x: 4, y: 2, width: 32, height: 24 }, mod: 'a' }]),
        desktop.anchors
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} window checks`);
    process.exit(0);
}

// `createWindows` over stand-ins. Mods `a` and `b` run in `pages.a` and `pages.b`. `guards` is the guard each
// channel's declaration names, by its name. `fromPage(name, page, payload)` sends a window channel as `page` and
// answers what it answers; `openSurface(name, surface)` has a page open a window's content; `focus(page)` and
// `end(page)` are a page taking the keyboard and its document ending; `webOf` maps a web page to the mod's page that
// shows it. `desktop` records what the desktop was asked, `key` the id of its key window, `may` the mods that may
// activate for the local seat, `frames` the frames it keeps, by the level, the mod and the name; `host` what the host
// app was asked; `stages` the stages made, each with what it laid last; `sent` what the pages were told, by the
// channel's last word.
function windowsOver(createWindows) {
    const handlers = {};
    const guards = {};
    const sent = [];
    const allowed = new Map(); // a surface's name -> its onOpen
    const focusListeners = new Map(); // a page -> what hears it take the keyboard
    const endListeners = new Map(); // a page -> what hears its document end
    const listenedAs = new Map(); // a page whose keys reach the keys of the app -> the page they are of
    const pagesClosed = [];
    const webOf = new Map();
    const stages = [];
    const pages = { a: { name: 'page-a' }, b: { name: 'page-b' }, c: { name: 'page-c' } };
    // What the regions lay out, child id -> { window, rect }, all of `b`'s; and the children's pages each stage shows.
    const laidOut = new Map();
    const shown = new Map();
    const modOf = new Map([
        [pages.a, 'a'],
        [pages.b, 'b'],
    ]);
    const changes = [];
    const desktop = {
        opened: [],
        closed: [],
        fronted: [],
        pressed: [],
        inputs: [],
        may: new Set(['b']),
        titles: [],
        key: null,
        frames: new Map(),
        panels: [],
        panelsClosed: [],
        panelPressed: [],
        panelsFronted: [],
        anchors: [],
        change: () => changes.forEach((listener) => listener()),
    };
    const host = { shown: [], closed: [] };
    const deckit = {
        channels: {
            bind: (declared) => {
                guards[declared.channel] = declared.guard;
                return {
                    handle: (handler) => (handlers[declared.channel] = handler),
                    on: (handler) => (handlers[declared.channel] = handler),
                    send: (page, payload) => sent.push({ channel: declared.channel.split('-').at(-1), page, payload }),
                };
            },
        },
        mods: {
            modOf: (page) => modOf.get(page) ?? null,
            runs: () => [{ run: { mod: { id: 'c' }, state: 'running', summary: { view: true } }, page: pages.c }],
        },
        pages: { whenEnds: (page, listener) => endListeners.set(page, listener) },
    };
    const PAGES = {
        allowSurface: (_page, name, onOpen) => allowed.set(name, onOpen),
        whenFocused: (page, listener) => focusListeners.set(page, listener),
        close: (page) => pagesClosed.push(page),
        isAlive: (page) => !pagesClosed.includes(page),
    };
    const overlayListeners = [];
    const OVERLAY = {
        onChange: (listener) => overlayListeners.push(listener),
        withOverlays: (laid) => laid,
        ownerOf: (page) => page,
    };
    const DESKTOP = {
        open: (window, { activates = true } = {}) => desktop.opened.push({ ...window, activates }),
        close: (window) => desktop.closed.push(window.id),
        orderFront: (window, { activates = true } = {}) =>
            desktop.fronted.push({ id: window.id, key: activates, activates }),
        press: (window) => desktop.pressed.push(window.id),
        openPanel: (window) => desktop.panels.push(window),
        closePanel: (window) => desktop.panelsClosed.push(window.id),
        pressPanel: (window) => desktop.panelPressed.push(window.id),
        orderFrontPanel: (window, { activates = true } = {}) =>
            desktop.panelsFronted.push({ id: window.id, activates }),
        setAnchors: (window, anchors) => desktop.anchors.push({ id: window.id, anchors }),
        keyPanel: () => null,
        toDesktop: () => {},
        localSeat: 'local',
        activation: {
            input: (seat, mod) => desktop.inputs.push(`${seat}:${mod}`),
            mayActivate: (seat, mod) => seat === 'local' && desktop.may.has(mod),
        },
        setTitle: (_window, title) => desktop.titles.push(title),
        keptFrameOf: (window) => desktop.frames.get(`${window.level}:${window.mod}/${window.name}`) ?? null,
        remember: (window, frame) => desktop.frames.set(`${window.level}:${window.mod}/${window.name}`, frame),
        minimize() {},
        zoom() {},
        move() {},
        doubleClick() {},
        resize() {},
        update: () => changes.forEach((listener) => listener()),
        isKey: (window) => window.id === desktop.key,
        stateOf: (window) => ({
            shown: true,
            key: window.id === desktop.key,
            ...window.size,
            titleBar: { height: 48, controlsWidth: 78 },
        }),
        onChange: (listener) => changes.push(listener),
    };
    const makeStage = () => {
        const stage = {
            laid: [],
            place: () => {},
            size: () => ({ width: 400, height: 300 }),
            whenResized: () => () => {},
            lay: (laid) => (stage.laid = laid),
            close() {},
        };
        stages.push(stage);
        return stage;
    };
    const windows = createWindows({
        deckit,
        web: { pageFor: (page) => (modOf.has(page) ? page : (webOf.get(page) ?? null)) },
        PAGES,
        OVERLAY,
        REGION: {
            laidOut: (parent, shows) => new Map([...laidOut].filter(([child]) => parent === 'b' && shows(child))),
            show: (stage, given) =>
                shown.set(
                    stage,
                    given.map(({ name }) => name)
                ),
            shownElsewhere: () => false,
        },
        DESKTOP,
        KEY: { listen: (page, owner) => listenedAs.set(page, owner) },
        makeStage,
        showWindow: (control, options) => host.shown.push({ control, ...options }),
        closeWindow: (control) => host.closed.push(control),
    });
    windows.start();
    return {
        windows,
        guards,
        pages,
        desktop,
        host,
        sent,
        stages,
        laidOut,
        shown,
        listenedAs,
        pagesClosed,
        webOf,
        fromPage: (name, page, payload) => handlers[`deckit-shell:window-${name}`]?.(payload, page),
        openSurface: (name, surface) => allowed.get(name)(surface),
        overlayChanged: (page) => overlayListeners.forEach((listener) => listener(page)),
        focus: (page) => focusListeners.get(page)(),
        end: (page) => endListeners.get(page)(),
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
