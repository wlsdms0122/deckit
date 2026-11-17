// The conformance runner's host app: Electron's main process embedding the deckit archive beside it as any host app
// does, through the environment and connect, set up as the case's [host] says. It reaches deckit only through what
// connect answers, and talks to the runner over a socket, a JSON message a line: it says once whether the start settled
// or was refused (deckit.whenStarted()), answers each call and look it is asked, a start and a call once no run is
// between two states, and quits when asked. It stacks a layer of its own over deckit on each mod's page (page.js),
// which makes the requests a call hands it and keeps what its listeners heard, attaches the web engine on the bases web
// and shell and the shell over it, under the layer, on the base shell, runs main process modules where an owner it
// ships asks for them, and opens none of the addresses it is handed to open outside the app: it keeps each one, for the
// look opened. On the base web it shows a mod's page in a window of its own once its layer shows a web page there, and
// presses a web page its layer showed with WebKit's input, as a person's press comes. On the base shell it shows the
// desktop in a host window the size of a screen of its own, under the bar the case names across its top, floats each
// overlay window over it and hands a person's hand on a window or on the Dock as a host app hands it, nothing of either
// on the person's screen, and presses a key in the page the shell gave the keyboard to, the app in front, never the
// person's keyboard, or in another app, which reaches the chords the shell holds outside the app, held by the host,
// never with the machine. It shows none of the system's notifications: it keeps each one, for the look shown, and
// presses one when asked. It shows no dialog of folders: each answers the folders the case names. It shows no path
// where it lies: it keeps each one, for the look revealed. It knows the app for an address of a scheme only where the
// case names one. Its clipboard is a file of the run's, never the person's. A request fetched through a web session
// reaches no address but on the loopback address. On the base shell it hands the shell the mods the case keeps in the
// Dock at the first start, and the host app's look, light or dark, as the case names it, as it starts and as the look
// changes; it reads what a page of the shell's wears, its colour scheme and the custom properties of its root. It keeps
// what the shell lays on the desktop and in each overlay window, for the children's views laid over regions, and drops
// files from outside the app on the page laid at a point of a window, through WebKit, as the machine drops them, never
// in a drag of the machine's. It listens for parties as any host app does, on the socket in its folder of deckit: the
// runner is each party, and after what one did the host says once the run its principal's proof hosts has settled.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { app, globalShortcut } = require('electron');

const setup = JSON.parse(fs.readFileSync(process.env.DECKIT_CONFORMANCE_SETUP, 'utf8'));
const LIBRARY = path.join(__dirname, 'deckit');

// It never takes the person's screen, keyboard or chords: the runner hands every input itself.
app.setPath('userData', setup.electron);
app.setPath('downloads', setup.downloads);
app.focus = () => {};
globalShortcut.register = () => true;
globalShortcut.unregister = () => {};
app.whenReady().then(() => app.setActivationPolicy('accessory'));

const socket = net.connect(setup.port, '127.0.0.1');
const say = (message) => socket.write(JSON.stringify(message) + '\n');
let environment = null;
let deckit = null;
let settled = false;
let call = null; // the channels to the conformance layer on a mod's page
let heard = null;
let show = null; // the channel to the conformance layer that shows a web page
let delegated = null;
let quiet = null; // the channel to the conformance layer that waits until the pages it shows are quiet
let engine = null; // what attachWeb answered, on the base web
let webkit = null; // WebKit's module, which presses a web page
const adopted = []; // each web page, in the order adopted, on the base web
const showed = new Map(); // a show's place -> the web page it showed
const windowed = new WeakSet(); // the mods' pages shown in a window of the host's
const opened = []; // { url, activates }: each address handed to open outside the app, in the order handed
const shown = []; // { notification: { title, body, silent }, onClick }: each notification handed to show, in order
const revealed = []; // each path handed to show where it lies, in the order handed
// The machine's screen on the base shell, which the host window fills, the desktop in it: nothing of either is on the
// person's screen.
const SCREEN = Object.freeze({ width: 1280, height: 800 });
let controls = null; // what the host drives of the shell, handed as it starts, on the base shell
const LOCAL_SEAT = 'local'; // the id of the seat at the host window
// Each overlay window the shell asks the host to show, back to front: `{ control, frame, key, holder }`, `frame` on
// SCREEN, `holder` the window of the host's off every screen its stage is placed in.
const floating = [];
// The machine's keyboard on the base shell: the page of the app's that has it, as the shell last gave it, the app in
// front; and what hears each key pressed in a page, before it and after it did not handle it, by the page.
let keyboard = null;
const capturing = new Map(); // page -> [handler(event) -> taken]
const unhandling = new Map(); // page -> [handler(keystroke) -> taken]
// The chords the machine gives the host app outside it, as the shell holds them: chord -> handler(), and each it does
// not give, by its chord, as the case names them.
const hotkeys = new Map();
const chordOf = ({ code, meta = false, control = false, alt = false, shift = false }) =>
    JSON.stringify([code, meta, control, alt, shift]);
const unavailable = new Set((setup.unavailable ?? []).map(chordOf));
let title = null; // what the shell last titled the desktop
let laid = []; // what the shell last laid on the desktop, bottom to top: `{ page, rect, clip, input }`
// The host app's looks, as a host app hands the shell one: its content's colours, its line and its face.
const FACE = 'system-ui, sans-serif';
const LOOKS = Object.freeze({
    dark: { contentBg: '#1a1d21', contentColor: '#d1d2d3', border: '1px solid rgba(121,124,129,.3)', font: FACE },
    light: { contentBg: '#ffffff', contentColor: '#1d1c1d', border: '1px solid rgba(29,28,29,.13)', font: FACE },
});
const named = new Map(); // a name -> the page of the shell's made under it last, on the base shell
// What the host app answers the shell, as a host app answers it, on the base shell: the desktop shown as the shell
// starts, in the host window, which comes up as the shell asks; each overlay window floating over every app, at the
// frame the shell kept for it where that lies on the screen, or else centred across it, a fifth of the way down, at
// the size the mod gives it now, in front, and taking the keyboard unless `activates` is false; and a web page's
// window one on the desktop.
const HOST = Object.freeze({
    start(given) {
        controls = given;
        given.setTheme(LOOKS[setup.appearance]);
        given.desktop.show();
        if (setup.bar) given.desktop.present({ titleBar: { height: setup.bar, controlsWidth: 0 } });
    },
    show() {
        resignFloating();
        controls?.desktop.show();
        controls?.desktop.focus();
    },
    desktopTitled(given) {
        title = given;
    },
    showWindow(control, { activates = true } = {}) {
        let one = floating.find((each) => each.control === control);
        const { width, height } = control;
        if (!one) {
            const kept = control.keptFrame;
            const fits =
                !!kept &&
                kept.x >= 0 &&
                kept.y >= 0 &&
                kept.x + width <= SCREEN.width &&
                kept.y + height <= SCREEN.height;
            const at = fits
                ? { x: kept.x, y: kept.y }
                : { x: Math.round((SCREEN.width - width) / 2), y: Math.round(SCREEN.height / 5) };
            one = { control, frame: { ...at, width, height }, key: false, holder: null };
        } else floating.splice(floating.indexOf(one), 1);
        one.frame = { ...one.frame, width, height };
        floating.push(one);
        const offScreen = { x: -40000 + one.frame.x, y: -38000 + one.frame.y, width, height };
        if (!one.holder) {
            one.holder = environment.windows.open({ kind: 'floating', size: { width, height } });
            one.holder.setFrame(offScreen);
            control.place(one.holder);
            one.holder.show({ focus: false });
        } else one.holder.setFrame(offScreen);
        if (activates) focusFloating(one);
    },
    closeWindow(control) {
        const at = floating.findIndex((each) => each.control === control);
        if (at >= 0) floating.splice(at, 1)[0].holder?.close();
    },
});
// The overlay window that has the keyboard gives it up.
const resignFloating = () => {
    for (const one of floating.filter(({ key }) => key)) {
        one.key = false;
        one.control.didResignKey();
    }
};
const focusFloating = (one) => {
    if (one.key) return;
    resignFloating();
    one.key = true;
    one.control.focus();
};
// The pages of the base shell, the machine's keyboard going to the page the shell gives it to, and each one the shell
// makes under a name kept by that name.
const pagesOn = (pages) =>
    Object.create(pages, {
        make: {
            value: (options) => {
                const page = pages.make(options);
                if (options?.name) named.set(options.name, page);
                return page;
            },
        },
        focus: {
            value: (page) => {
                keyboard = page;
                return pages.focus(page);
            },
        },
    });
// The keys of the base shell: what hears a key pressed in a page kept for the input key and hearing the page too, for
// a key put into it, the app in front with the page that has the keyboard, and the chords the machine gives the host
// app outside it held here, never with the machine: one the case names unavailable, or one held already, is not given.
const keysOn = (keys) => {
    const kept = (heard, hear) => (page, handler) => {
        heard.set(page, [...(heard.get(page) ?? []), handler]);
        hear(page, handler);
    };
    const hotkey = (keystroke, handler) => {
        const chord = chordOf(keystroke);
        if (unavailable.has(chord) || hotkeys.has(chord)) return null;
        hotkeys.set(chord, handler);
        return () => hotkeys.get(chord) === handler && hotkeys.delete(chord);
    };
    return Object.create(keys, {
        capture: { value: kept(capturing, keys.capture) },
        unhandled: { value: kept(unhandling, keys.unhandled) },
        focused: { value: () => keyboard },
        hotkey: { value: hotkey },
    });
};
// The stages of the base shell, each in a window of the host's off every screen, shown there so that its pages draw,
// and nothing of it on the person's screen. The first, the desktop's, is the size of the host window and keeps what the
// shell lays last, bottom to top, for a drop and the look regions; each other, an overlay window's, is placed in the
// window its overlay window's holder is, and keeps what the shell lays last in `staged`, for the look regions.
let desktopStaged = false;
const staged = []; // { window, laid }: each overlay window's stage, the window it is placed in and what it lays
const STAGE = () => {
    const stage = environment.stage();
    if (!desktopStaged) {
        desktopStaged = true;
        const holder = environment.windows.open({ kind: 'floating', size: { ...SCREEN } });
        holder.setFrame({ x: -40000, y: -40000, ...SCREEN });
        stage.place(holder);
        holder.show({ focus: false });
        return Object.freeze({
            place() {},
            size: () => ({ ...SCREEN }),
            whenResized: () => () => {},
            show() {},
            lay(layers) {
                laid = layers;
                stage.lay(layers);
            },
            hit: (layers, point) => stage.hit(layers, point),
            capture: (layers, options) => stage.capture(layers, options),
            close() {},
        });
    }
    const record = { window: null, laid: [] };
    staged.push(record);
    return Object.freeze({
        place(window, options) {
            record.window = window;
            stage.place(window, options);
        },
        size: () => stage.size(),
        whenResized: (listener) => stage.whenResized(listener),
        show: (on) => stage.show(on),
        lay(layers) {
            record.laid = layers;
            stage.lay(layers);
        },
        hit: (layers, point) => stage.hit(layers, point),
        capture: (layers, options) => stage.capture(layers, options),
        close() {
            staged.splice(staged.indexOf(record), 1);
            stage.close();
        },
    });
};

const settle = (came) => {
    if (settled) return;
    settled = true;
    say({ settled: came });
};
// A host's own request refused: everything it hands deckit before the start is part of starting it.
const refused = (error) =>
    settle({ refuses: 'call', kind: error?.kind ?? null, message: String(error?.message ?? error) });

try {
    const ELECTRON = require(path.join(LIBRARY, 'main.js'));
    const DECKIT = require(path.join(LIBRARY, 'shell-main.js'));
    const described = JSON.parse(fs.readFileSync(path.join(LIBRARY, 'deckit.json'), 'utf8'));
    environment = ELECTRON.environment({
        preload: path.join(__dirname, setup.preload),
        core: path.join(LIBRARY, described.core),
        host: { openWindow },
    });
    const open = Object.freeze({
        ...environment.open,
        url: async (url, { activate = true } = {}) => {
            opened.push({ url, activates: activate });
        },
        // The app for an address of a scheme the case names one for, and none for any other.
        appFor: (url) => setup.apps[new URL(url).protocol.slice(0, -1).toLowerCase()] ?? '',
        // A file kept as the file URL of its path, each segment of it percent-encoded.
        file: async (file, { activate = true } = {}) => {
            opened.push({ url: 'file://' + file.split('/').map(encodeURIComponent).join('/'), activates: activate });
            return true;
        },
    });
    // Each notification kept, and answered as one the system took; a press calls its onClick.
    const notifications = Object.freeze({
        show: async ({ title, body, silent }, { onClick }) => {
            shown.push({ notification: { title, body, silent }, onClick });
            return true;
        },
    });
    // The clipboard's text in the run's file, '' while there is none: it stands as the host app quits and starts.
    const clipboard = Object.freeze({
        readText: () => (fs.existsSync(setup.clipboard) ? fs.readFileSync(setup.clipboard, 'utf8') : ''),
        writeText: (text) => fs.writeFileSync(setup.clipboard, text),
    });
    // A dialog of folders shown nowhere: the person chooses the folders the case names, the first alone where the
    // dialog takes one, and none where it names none, as a person who cancels.
    const dialogs = Object.freeze({
        chooseFolders: async ({ multiple = false }) => (multiple ? setup.chosen : setup.chosen.slice(0, 1)),
    });
    // Each path kept, and shown nowhere.
    const reveal = (file) => {
        revealed.push(file);
    };
    // A request fetched through a session reaches no address but on the loopback address, where the runner serves the
    // case's sites: one to another address is not answered.
    const web = Object.create(environment.web, {
        fetch: {
            value: async (mod, session, request) => {
                if (new URL(request.url).hostname !== '127.0.0.1')
                    throw new Error(`${request.url} is not on the loopback address`);
                return environment.web.fetch(mod, session, request);
            },
        },
    });
    const given = Object.create(environment, {
        web: { value: web },
        open: { value: open },
        notifications: { value: notifications },
        clipboard: { value: clipboard },
        dialogs: { value: dialogs },
        reveal: { value: reveal },
        ...(setup.base === 'shell'
            ? {
                  stage: { value: STAGE },
                  pages: { value: pagesOn(environment.pages) },
                  keys: { value: keysOn(environment.keys) },
              }
            : {}),
        // A double click on a title bar zooms the window, as the person set it to.
        actionOnDoubleClick: { value: () => 'zoom' },
    });
    deckit = DECKIT.connect(given, {
        host: { notificationClicked: () => {}, restart: () => {} },
        config: {
            id: setup.id,
            name: 'Deckit conformance',
            api: setup.api,
        },
        folders: { home: setup.home, ship: setup.ship, sources: setup.sources },
    });
    // On the base web, the host's layer is over the web engine, the layer over it that it offers web pages to, and on
    // the base shell over the shell, whose handle `shell` it is handed.
    if (setup.base === 'system') deckit.stack('conformance');
    // Main process modules run, as a host app runs them, where an owner the case ships asks for them.
    if (setup.mainProcess) ELECTRON.attachMainProcess(deckit, given);
    // On the base web, the web engine is attached as a host app attaches it, and on the base shell the shell over it,
    // shown nowhere, before the case's fields and permissions, which come after the base's.
    if (setup.base === 'web') {
        engine = DECKIT.attachWeb(deckit, given);
        engine.onPage((page) => adopted.push(page));
        deckit.stack('conformance');
        // WebKit's module is the core's neighbour in the archive.
        webkit = { exports: {} };
        process.dlopen(webkit, path.join(path.dirname(path.join(LIBRARY, described.core)), 'deckit-web.node'));
        webkit = webkit.exports;
    }
    if (setup.base === 'shell') {
        webkit = { exports: {} };
        process.dlopen(webkit, path.join(path.dirname(path.join(LIBRARY, described.core)), 'deckit-web.node'));
        webkit = webkit.exports;
        const config = setup.dock ? { dock: setup.dock } : {};
        DECKIT.attach(deckit, given, { host: HOST, web: DECKIT.attachWeb(deckit, given), config });
        deckit.stack('conformance');
    }
    for (const field of setup.fields) deckit.fields.define(field);
    for (const permission of setup.permissions) deckit.permissions.define(permission);
    call = deckit.channels.bind({ channel: 'conformance/call', to: 'page', reply: true });
    heard = deckit.channels.bind({ channel: 'conformance/heard', to: 'page', reply: true });
    show = deckit.channels.bind({ channel: 'conformance/show', to: 'page', reply: true });
    delegated = deckit.channels.bind({ channel: 'conformance/delegated', to: 'page', reply: true });
    quiet = deckit.channels.bind({ channel: 'conformance/quiet', to: 'page', reply: true });
    // The start is complete, the launches at start included, or refused with its kind.
    deckit.whenStarted().then(() => runsSettled().then(() => settle({})), refused);
} catch (error) {
    refused(error);
}

let buffered = '';
socket.on('data', (chunk) => {
    buffered += chunk;
    for (let end; (end = buffered.indexOf('\n')) >= 0;) {
        const asked = JSON.parse(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
        if (asked.quit) app.quit();
        else
            Promise.resolve(
                asked.input === 'call' || asked.input === 'show'
                    ? request(asked)
                    : asked.input === 'press'
                      ? press(asked)
                      : asked.input === 'activate'
                        ? activate(asked)
                        : asked.input === 'window'
                          ? hand(asked)
                          : asked.input === 'key'
                            ? key(asked)
                            : asked.input === 'dock'
                              ? dockHand(asked)
                              : asked.input === 'appearance'
                                ? appear(asked)
                                : asked.input === 'drop'
                                  ? drop(asked)
                                  : asked.input === 'parties'
                                    ? partiesSettled(asked)
                                    : told().then(() => (asked.look === 'worn' ? worn(asked) : look(asked)))
            ).then(async (came) => {
                // A run a page starts or ends as it takes what it was told is waited for too.
                if (asked.input) {
                    await tellingsTaken();
                    await runsSettled();
                    await told();
                    while ((await runsSettled()) || (await tellingsTaken())) await told();
                }
                say({ id: asked.id, came });
            });
    }
});
socket.on('close', () => app.exit(0));

// What a call comes to: what the request the mod's run makes answers, `{ refuses, kind, message }` for its refusal, or
// `{ none }` where no run of the mod is running or its handle has no such member. `args` are the folders' paths and
// then the values the step writes; `step` its place, `handle` the name of the handle `member` starts at, `of` the
// place of the call whose answer it starts at instead, or whose listener's, where `handed`, `delegated` the place of the
// call of the host's delegate whose first value it starts at instead, and `listener` whether the request is handed one
// after its args.
async function request({ input, mod, member, args, step, handle, of, listener, handed, delegated, ...shows }) {
    const running = runningOf(mod);
    if (!running.page) return running;
    try {
        if (input === 'show') {
            showInWindow(running.page);
            const from = adopted.length;
            const came = await show.invoke(running.page, { step, ...shows });
            const page = adopted.slice(from).find((one) => engine.pageFor(one) === running.page);
            if (page) showed.set(step, page);
            return came;
        }
        return await call.invoke(running.page, { member, args, step, handle, of, listener, handed, delegated });
    } catch (error) {
        return { refuses: error.stage ?? null, kind: error.kind ?? null, message: String(error.message) };
    }
}

// Resolves once each mod's page has taken what main told it before, and main what the page asked as it took it, on
// the base shell: a window's page is told of it, and its mod's code answers.
async function told() {
    if (setup.base !== 'shell' || !deckit) return;
    for (let round = 0; round < 2; round++)
        for (const { run, page } of deckit.mods.runs())
            if (run.state === 'running') await quiet.invoke(page, {}).catch(() => {});
}

// The windows the person sees, back to front: those on the desktop, then the panel windows, in the order they opened,
// none of them key, then those floating over every app, each `{ mod, name, level, frame, key, minimized }`, `name` null
// for a web page's window, which has none. With `seat`, those the user at that seat sees: its own order, key window
// and minimized windows, the panel windows on its screen, and those floating for the local seat alone, whose screen
// the machine's is.
function windowsSeen(seat) {
    const normal = (controls?.desktop.windows(seat) ?? []).map(({ mod, name, frame, key, minimized }) => ({
        mod,
        name,
        level: 'normal',
        frame,
        key,
        minimized,
    }));
    const inBar = (controls?.desktop.panels(seat) ?? []).map(({ mod, name, frame }) => ({
        mod,
        name,
        level: 'panel',
        frame,
        key: false,
        minimized: false,
    }));
    const over = (seat && seat !== LOCAL_SEAT ? [] : floating).map(({ control, frame, key }) => ({
        mod: control.mod,
        name: control.name,
        level: 'overlay',
        frame: { ...frame },
        key,
        minimized: false,
    }));
    return [...normal, ...inBar, ...over];
}

// The desktop as the person sees it: `{ active, attention, title }`, the active mod by its id, left out where there is
// none, the mods that ask for attention, and the title the shell gives the desktop. With `seat`, the active mod of the
// user at that seat and the mods that ask for its attention, and no title, which is the host window's.
function desktopSeen(seat) {
    const active = controls.desktop.active(seat);
    const seen = { ...(active === null ? {} : { active }), attention: controls.desktop.attention(seat) };
    return seat ? seen : { ...seen, title };
}

// What a person's hand on a window comes to: `{}`, or `{ none }` where the mod has no window of the name on screen,
// a web page's window where `name` is null. On a window on the desktop, the host window taking the keyboard from an
// overlay window: a press in it, a click of its button `action` (`close`, `minimize`, `zoom`), a drag of its title
// bar by `by`, a drag of its edge `edge` by `by`, or a double click on its title bar; on a panel window,
// a press alone. On one floating over every app, a press, or a drag by `by`, either taking it the keyboard, the shell
// told the frame a drag leaves it at.
function hand({ mod, name, action, edge, by = { x: 0, y: 0 } }) {
    if (!controls) return { none: 'the shell has not started' };
    const on = (each) => each.mod === mod && each.name === name;
    const normal = controls.desktop
        .windows()
        .filter((each) => on(each) && !each.minimized)
        .at(-1);
    const over = floating.find(({ control }) => on(control));
    const panel = controls.desktop.panels().find(on);
    if (panel && action === 'press') {
        resignFloating();
        controls.desktop.focus();
        controls.desktop.hand.press(panel.id);
        return {};
    }
    if (panel) return { none: `a panel window has no ${action} a hand gives` };
    if (normal) {
        resignFloating();
        controls.desktop.focus();
        const { hand: person } = controls.desktop;
        if (action === 'press') person.press(normal.id);
        else if (['close', 'minimize', 'zoom'].includes(action)) person.button(normal.id, action);
        else if (action === 'move') person.move(normal.id, by.x, by.y);
        else if (action === 'resize') person.resize(normal.id, edge, by.x, by.y);
        else if (action === 'doubleClick') person.doubleClick(normal.id);
        return {};
    }
    if (over && action === 'press') {
        focusFloating(over);
        return {};
    }
    if (over && action === 'move') {
        focusFloating(over);
        over.frame = { ...over.frame, x: over.frame.x + by.x, y: over.frame.y + by.y };
        over.control.didMove({ ...over.frame });
        return {};
    }
    if (over) return { none: `an overlay window has no ${action} a hand gives` };
    return { none: `${mod} has no window ${name} on screen` };
}

// The Dock as the person sees it, its items in order, each `{ mod, pinned, running, attention, active }`. With `seat`,
// as the user at that seat sees it.
function dockSeen(seat) {
    return controls.desktop.dock(seat).map(({ id, ...marks }) => ({ mod: id, ...marks }));
}

// What a person's hand on the Dock's item of `mod` comes to: `{}`, or `{ none }` where the Dock has no item of it, its
// menu offers no such choice, or `to` names no item kept there beside it. The host window takes the keyboard from an
// overlay window, then by `action`: `click` a click on the item, `quit`, `keep` and `remove` that choice of its menu,
// Quit offered while the mod runs, Keep in Dock while the item is not kept and Remove from Dock while it is, and
// `drag` a drag of a kept item onto the place of the kept item of `to`, let go; once what a click or Quit asked of the
// system is done.
async function dockHand({ mod, action, to }) {
    const items = controls ? controls.desktop.dock() : [];
    const item = items.find(({ id }) => id === mod);
    if (!item) return { none: `the Dock has no item of ${mod}` };
    const offered = { quit: item.running, keep: !item.pinned, remove: item.pinned }[action] ?? true;
    if (!offered) return { none: `the menu of ${mod} offers no ${action}` };
    if (action === 'drag' && !(item.pinned && items.some(({ id, pinned }) => id === to && pinned)))
        return { none: `${mod} and ${to} are not both kept in the Dock` };
    resignFloating();
    controls.desktop.focus();
    const { dock } = controls.desktop.hand;
    if (action === 'click') await dock.click(mod);
    else if (action === 'quit') await dock.quit(mod);
    else if (action === 'keep' || action === 'remove') dock.keep(mod, action === 'keep');
    else dock.drag(mod, to);
    return {};
}

// What a key comes to: `keystroke` pressed in the page that has the keyboard, which handles none of it, `{}`, or
// `{ none }` where no page has it. What hears it before the page does may take it; what hears it after, where nothing
// took it. Pressed `outside`, in another app in front: the chord the machine gave the host app, if it gave it, `{}`.
function key({ keystroke, outside }) {
    if (outside) {
        hotkeys.get(chordOf(keystroke))?.();
        return {};
    }
    if (!keyboard) return { none: 'no page has the keyboard' };
    const { code, meta = false, control = false, alt = false, shift = false } = keystroke;
    const pressed = Object.freeze({ code, meta, control, alt, shift });
    const page = keyboard;
    const taken = (capturing.get(page) ?? []).some((handler) =>
        handler(Object.freeze({ type: 'keydown', ...pressed }))
    );
    if (!taken) (unhandling.get(page) ?? []).some((handler) => handler(pressed));
    return {};
}

// What a press comes to: the notification at the place `notification` in what shown answers pressed, `{}`, or
// `{ none }` where there is none there.
function press({ notification }) {
    const one = shown[notification - 1];
    if (!one) return { none: `no notification was shown at ${notification}` };
    one.onClick();
    return {};
}

// What an activate comes to: the web page the show at the place `of` showed pressed with the mouse's button, down and
// up, inside it, `{}` once the pages the layer shows are quiet, or `{ none }` where it is not there.
async function activate({ mod, of }) {
    const running = runningOf(mod);
    if (!running.page) return running;
    const page = showed.get(of);
    if (!page || page.isDestroyed()) return { none: `step ${of} showed no web page that is there` };
    try {
        for (const type of ['down', 'up']) webkit.sendMouse(page.id, { type, x: PRESSED.x, y: PRESSED.y });
    } catch (error) {
        return { none: `the page took no press: ${error.message}` };
    }
    return quiet.invoke(running.page, {});
}

// A mod's page, on the base web, shown in a window of the host's, filled by it, so that the web pages laid over it are
// on screen and take input: once.
function showInWindow(page) {
    if (setup.base !== 'web' || windowed.has(page)) return;
    windowed.add(page);
    const window = environment.windows.open({ size: { width: 800, height: 600 } });
    const stage = environment.stage();
    stage.place(window);
    const lay = () => stage.lay([{ page, rect: { x: 0, y: 0, ...stage.size() } }]);
    stage.whenResized(lay);
    lay();
    window.show({ focus: false });
}

// The running run of the mod listed under `mod`, `{ page }`, or `{ none }`.
function runningOf(mod) {
    if (!deckit) return { none: 'deckit was not connected' };
    const running = deckit.mods.runs().find(({ run }) => run.mod.id === mod && run.state === 'running');
    return running ? { page: running.page } : { none: `no run of ${mod} is running` };
}

// Resolves once each telling the web engine told a web page's document of its own accord is taken, a click on a
// notification or the news that a site may have notifications, and then once each running mod's page is quiet, as
// after a press: what the document asked as it took it is told by then. Answers whether one was untaken.
async function tellingsTaken() {
    if (!environment?.web.untaken() || !deckit) return false;
    while (environment.web.untaken()) await new Promise((resolve) => setTimeout(resolve, 10));
    for (const { run, page } of deckit.mods.runs())
        if (run.state === 'running') await quiet.invoke(page, {}).catch(() => {});
    return true;
}

// Resolves once no run is between two states: each has started, or has ended. Answers whether one was.
async function runsSettled() {
    const moving = ({ run }) => run.state === 'launching' || run.state === 'terminating';
    const was = !!deckit?.mods.runs().some(moving);
    while (deckit?.mods.runs().some(moving)) await new Promise((resolve) => setTimeout(resolve, 10));
    return was;
}

// Resolves once deckit has taken what the parties did, `{}`: of each principal a party proved, `{ principal, open }`,
// the run is not ending while the party's end of its transport connection is `open`, and has ended once it is not.
async function partiesSettled({ attached }) {
    const state = (principal) => deckit?.mods.runOf(principal)?.state ?? 'notRunning';
    const moving = ({ principal, open }) =>
        open ? state(principal) === 'terminating' : state(principal) !== 'notRunning';
    while (attached.some(moving)) await new Promise((resolve) => setTimeout(resolve, 10));
    return {};
}

// What a look comes to: `{ answers }`, `{ refuses, kind, message }` for a bundle found and not taken or a run refused,
// or `{ none }` with what the host was given instead. deckit.mods.list() holds every bundle found, in its order.
function look({ look: what, mod, seat: named = null }) {
    if (!deckit) return { none: 'deckit was not connected' };
    const seat = named ?? undefined;
    if (seat && !deckit.seats.list().some(({ id }) => id === seat)) return { none: `no seat ${seat} is open` };
    if (what === 'opened') return { answers: opened };
    if (what === 'shown') return { answers: shown.map(({ notification }) => notification) };
    if (what === 'revealed') return { answers: revealed };
    if (what === 'windows') return { answers: windowsSeen(seat) };
    if (what === 'desktop') return controls ? { answers: desktopSeen(seat) } : { none: 'no desktop is shown' };
    if (what === 'dock') return controls ? { answers: dockSeen(seat) } : { none: 'no desktop is shown' };
    if (what === 'regions') return controls ? { answers: regionsSeen() } : { none: 'no desktop is shown' };
    if (what === 'heard' || what === 'delegated') {
        const running = runningOf(mod);
        return running.page ? (what === 'heard' ? heard : delegated).invoke(running.page) : running;
    }
    const found = deckit.mods.list();
    if (what === 'mods') return { answers: found.map(({ id }) => id) };
    if (what !== 'mod' && what !== 'run') return { none: `this host answers no look ${what}` };
    const one = found.find((entry) => entry.id === mod);
    if (!one) return { none: `no bundle under the id ${mod} was found` };
    if (one.refusal) return { refuses: one.refusal.stage, kind: one.refusal.kind, message: one.refusal.message };
    if (what === 'run') return runOf(mod);
    return { answers: one };
}

// What deckit answers of the mod's latest run: its state, or the refusal at launch it came to. A mod with no run since
// the start does not run.
function runOf(id) {
    const run = deckit.mods.runOf(id);
    if (!run) return { answers: 'notRunning' };
    if (run.refusal) return { refuses: run.refusal.stage, kind: run.refusal.kind, message: run.refusal.message };
    return { answers: run.state };
}

// The host app's look changes to `appearance`, which the host hands the shell, on the base shell.
function appear({ appearance }) {
    if (!controls) return { none: 'no shell is attached' };
    controls.setTheme(LOOKS[appearance]);
    return {};
}

// What the page of the run of `mod` wears, or the desktop's own page where `mod` is null, on the base shell:
// `{ dark, properties }`, whether its colour scheme is dark, and the value of each custom property of its root that
// `properties` names and the root holds, trimmed, by name.
async function worn({ mod, properties }) {
    if (!controls) return { none: 'no shell is attached' };
    const page = mod ? runningOf(mod).page : named.get('desktop');
    if (!page) return mod ? runningOf(mod) : { none: 'no desktop is shown' };
    const source = `const root = document.documentElement;
        const style = getComputedStyle(root);
        const properties = {};
        for (const name of ${JSON.stringify(properties)}) {
            const value = style.getPropertyValue(name).trim();
            if (value) properties[name] = value;
        }
        return JSON.stringify({ dark: style.colorScheme === 'dark', properties });`;
    return { answers: JSON.parse(await page.evaluate(source, 'deckit')) };
}

// Whether `point`, on the desktop, is inside `rect`.
const inside = (point, { x, y, width, height }) =>
    point.x >= x && point.x < x + width && point.y >= y && point.y < y + height;

// The views of the mods laid over the regions of the windows, back to front: on the desktop and in its bar, then in
// each overlay window, each `{ mod, parent, window, frame }`: the child's id, the mod and the name of the window, and
// the rect it is laid at on the screen, cut to the window's frame. A mod's page laid cut to a window's frame is a
// child's view; the window's content is a page of its own.
function regionsSeen() {
    const pages = new Map(deckit.mods.runs().map(({ run, page }) => [page, run.mod.id]));
    const cut = (rect, clip) => {
        const x = Math.max(rect.x, clip.x);
        const y = Math.max(rect.y, clip.y);
        const width = Math.max(0, Math.min(rect.x + rect.width, clip.x + clip.width) - x);
        const height = Math.max(0, Math.min(rect.y + rect.height, clip.y + clip.height) - y);
        return { x, y, width, height };
    };
    const windows = [...controls.desktop.windows(), ...controls.desktop.panels()];
    const desktop = laid.flatMap(({ page, rect, clip }) => {
        const window =
            clip && windows.find(({ frame }) => ['x', 'y', 'width', 'height'].every((k) => frame[k] === clip[k]));
        if (!pages.has(page) || !window) return [];
        return [{ mod: pages.get(page), parent: window.mod, window: window.name, frame: cut(rect, clip) }];
    });
    const overlays = floating.flatMap(({ control, frame: { x: left, y: top }, holder }) =>
        (staged.find(({ window }) => window === holder)?.laid ?? []).flatMap(({ page, rect, clip }) => {
            if (!pages.has(page) || !clip || !rect) return [];
            const { x, y, width, height } = cut(rect, clip);
            const frame = { x: left + x, y: top + y, width, height };
            return [{ mod: pages.get(page), parent: control.mod, window: control.name, frame }];
        })
    );
    return [...desktop, ...overlays];
}

// What a drop comes to: the files at `paths` dragged in from outside the app and dropped at `at`, from the top left of
// the window on the desktop of the run of `mod` named `name`, on the page the shell laid there that takes the pointer
// at that point, `{}`, or `{ none }` where the mod has no such window on screen or no page takes it, through WebKit, as
// the machine drops them.
async function drop({ mod, name, paths, at }) {
    if (!controls) return { none: 'no desktop is shown' };
    const window = controls.desktop
        .windows()
        .filter((each) => each.mod === mod && each.name === name && !each.minimized)
        .at(-1);
    if (!window) return { none: `${mod} has no window ${name} on screen` };
    const { frame } = window;
    const point = { x: frame.x + at.x, y: frame.y + at.y };
    if (!inside(point, frame)) return { none: `the point is not in the window ${name}` };
    // A window drawn scaled, as it opens or goes, takes no press until it rests, so the hand drops once it does.
    for (let waited = 0; laid.some(({ scale }) => scale) && waited < 2000; waited += 10) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const hit = [...laid]
        .reverse()
        .find(
            ({ page, rect, clip, input, hidden }) =>
                !hidden &&
                page &&
                inside(point, rect) &&
                (!clip || inside(point, clip)) &&
                (!input || input.some((one) => inside({ x: point.x - rect.x, y: point.y - rect.y }, one)))
        );
    if (!hit) return { none: 'no page takes the pointer there' };
    try {
        await webkit.sendDrop(hit.page.id, { files: paths, x: point.x - hit.rect.x, y: point.y - hit.rect.y });
    } catch (error) {
        return { none: `the page took no drop: ${error.message}` };
    }
    return {};
}

// Where in a web page a press lands: from its top left.
const PRESSED = Object.freeze({ x: 10, y: 10 });

// A page deckit shows on its own, in a window of the environment's, shown without taking the keyboard.
function openWindow({ title = '', place, ...rest }) {
    if (setup.base === 'shell') return controls.openWindow({ title, place, ...rest });
    const window = environment.windows.open({ title, size: { width: 800, height: 600 } });
    place(window);
    window.show({ focus: false });
    return window;
}
