// Deckit.app's host app (deckit-app/app) over stand-ins for its windows, its theme and what the shell hands it: the
// desktop in the host window, full size under the bar, opened as the shell starts and again after it closes, brought
// up by a second show and by a notification's click, titled by the desktop; each overlay window of a mod in a floating
// window of its own, kept by its mod, made once until it closes; and a web page's window handed to the shell. Exits 1
// with a line for each check that failed.
const path = require('path');

const { createApp } = require(path.join(__dirname, '..', '..', 'deckit', 'deckit-app', 'app', 'app.js'));

function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const app = standIn();
    const host = app.host;
    host.show();
    host.desktopTitled('Editor');
    check('the host window waits for the shell to start', app.opened.length === 0, app.opened.length);

    host.start(app.controls);
    const [first] = app.opened;
    check(
        "the shell's start opens the host window, full size and kept, titled as the desktop was before",
        app.opened.length === 1 &&
            first.options.fullSize === true &&
            first.options.key === 'desktop' &&
            first.options.glass === app.controls.desktop.glass &&
            first.options.title === 'Editor' &&
            app.themes.length === 1,
        first?.options
    );
    check(
        'the desktop is placed in it, under the bar the window lays over its top, and shown',
        app.desktop.placed.at(-1) === first.window &&
            app.desktop.presented.at(-1)?.titleBar === app.WINDOW.titleBar &&
            app.desktop.shown(),
        { presented: app.desktop.presented, shown: app.desktop.shown() }
    );
    first.options.focus();
    check('the window taking the keyboard hands it to the desktop', app.desktop.focused === 1, app.desktop.focused);

    host.show();
    check(
        'a second show brings the open host window up, taking the keyboard',
        app.opened.length === 1 && first.window.shows.at(-1)?.focus === true,
        first.window.shows
    );
    host.desktopTitled('Note');
    check('the desktop titles the host window', app.titles.at(-1)?.title === 'Note', app.titles);

    first.window.close();
    check('the host window closing hides the desktop', !app.desktop.shown(), app.desktop.shown());
    host.notificationClicked();
    const second = app.opened.at(-1);
    check(
        "a notification's click opens the host window again, the desktop placed and shown in it",
        app.opened.length === 2 && app.desktop.placed.at(-1) === second.window && app.desktop.shown(),
        app.opened.length
    );

    const control = overlay('switcher', 600, 400);
    host.showWindow(control, { activates: false });
    host.showWindow(control);
    const floating = app.floating;
    check(
        "an overlay window floats in a window of its own, kept by its mod and name, at the mod's size, made once",
        floating.length === 1 &&
            floating[0].options.key === 'window-switcher/main' &&
            floating[0].options.size.width === 600 &&
            floating[0].options.size.height === 400 &&
            floating[0].options.focus === control.focus &&
            floating[0].options.blur === control.didResignKey &&
            control.placed === floating[0].window,
        floating.map(({ options }) => options)
    );
    check(
        'it is shown at the size the mod gives it now, taking the keyboard unless asked not to',
        app.floated.map(({ activates }) => activates).join() === 'false,true' &&
            app.sized.at(-1)?.size === control &&
            app.sized.at(-1)?.window === floating[0].window,
        app.floated
    );
    check('no window of a mod is a titled host window', app.opened.length === 2, app.opened.length);
    host.closeWindow(control);
    host.showWindow(control);
    check(
        'an overlay window closed is made again as it is shown',
        floating[0].window.isClosed() && floating.length === 2,
        floating.length
    );

    const options = { title: 'x', size: null, page: { name: 'web' } };
    const answered = host.openWindow(options);
    check(
        "a web page's window is the shell's, as it answers it",
        answered === app.web && app.controls.webAsked.at(-1) === options,
        app.controls.webAsked
    );

    if (failed.length) {
        console.error(failed.join('\n'));
        process.exit(1);
    }
    console.log(`ok: ${count} host checks`);
}

// A host window: `shows`, what each show asked; its listeners of `close` heard as it closes.
function windowOf() {
    let closed = false;
    const closing = new Set();
    return {
        shows: [],
        show(options) {
            this.shows.push(options);
        },
        close() {
            if (closed) return;
            closed = true;
            for (const listener of closing) listener();
        },
        isClosed: () => closed,
        onClose: (listener) => closing.add(listener),
    };
}

// What the shell hands the host for an overlay window: `placed`, the window it was put in.
function overlay(mod, width, height) {
    const control = {
        mod,
        name: 'main',
        width,
        height,
        placed: null,
        place: (window) => (control.placed = window),
        contains: () => false,
        focus() {},
        didResignKey() {},
    };
    return control;
}

// The host over stand-ins: `opened` and `floating`, each window it asked for with its options; `floated` and `sized`,
// what it asked of floating windows; `titles`; `desktop`, what the shell's desktop was asked; `themes`.
function standIn() {
    const opened = [];
    const floating = [];
    const floated = [];
    const sized = [];
    const titles = [];
    const themes = [];
    const WINDOW = {
        titleBar: Object.freeze({ height: 52, controlsWidth: 92 }),
        open(options) {
            const window = windowOf();
            opened.push({ options, window });
            options.place(window);
            window.show({ focus: true });
            return window;
        },
        openFloating(options) {
            const window = windowOf();
            floating.push({ options, window });
            options.place(window);
            return window;
        },
        float: (window, { activates }) => floated.push({ window, activates }),
        setViewSize: (window, size) => sized.push({ window, size }),
        setTitle: (window, title) => titles.push({ window, title }),
        recolor() {},
    };
    const THEME = { now: () => ({ theme: { contentBg: '#fff' } }), onChange() {} };
    let shown = false;
    const desktop = {
        glass: 0.5,
        placed: [],
        presented: [],
        focused: 0,
        place(window, { onClose }) {
            desktop.placed.push(window);
            window.onClose(onClose);
        },
        present: (given) => desktop.presented.push(given),
        show: () => (shown = true),
        hide: () => (shown = false),
        focus: () => desktop.focused++,
        shown: () => shown,
        contains: () => false,
    };
    const web = { setTitle() {}, close() {}, on: () => () => {} };
    const controls = {
        setTheme: (theme) => themes.push(theme),
        desktop,
        webAsked: [],
        openWindow(options) {
            controls.webAsked.push(options);
            return web;
        },
    };
    const host = createApp({ WINDOW, THEME }).make({ restart() {} });
    return { host, controls, desktop, WINDOW, opened, floating, floated, sized, titles, themes, web };
}

main();
