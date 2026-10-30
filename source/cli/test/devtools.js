// A client of the DevTools protocol for the app under test: its pages, each a session that evaluates, presses, types
// and takes screenshots, what any page threw while it was watched, its main process, and the web pages WebKit shows.
const fs = require('fs');
const path = require('path');

// Modifiers: alt 1, ctrl 2, meta 4, shift 8.
const ALT = 1;
const CTRL = 2;
const META = 4;
const SHIFT = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls until `probe` answers something truthy, or gives up after `ms`.
async function until(probe, ms = 6000) {
    const end = Date.now() + ms;
    for (;;) {
        const value = await probe();
        if (value || Date.now() > end) return value;
        await sleep(200);
    }
}

// `port` is the pages', the main process's the one after, and `module` the path of WebKit's module (deckit-web.node).
function connect({ port, shots, module }) {
    const sessions = new Map();
    const thrown = [];
    let inMain = null;

    async function targets() {
        try {
            return await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        } catch {
            return [];
        }
    }

    // The session of the first page whose address starts with `match`, or null.
    async function page(match) {
        const target = (await targets()).find(
            (candidate) => candidate.type === 'page' && candidate.url.startsWith(match)
        );
        return target ? sessionOf(target) : null;
    }

    // The sessions of every page whose address starts with `match`.
    async function pages(match) {
        const found = (await targets()).filter(
            (candidate) => candidate.type === 'page' && candidate.url.startsWith(match)
        );
        return Promise.all(found.map(sessionOf));
    }

    // Pages laid one over another, as views are in a window, drawn into one screenshot: `layers` from the bottom,
    // each { session, x, y }, its place in the window. Each is taken clear where it draws nothing.
    async function compose(name, layers) {
        const images = [];
        for (const { session, x = 0, y = 0 } of layers) images.push({ data: await session.capture(), x, y });
        const [bottom] = layers;
        const png = await bottom.session.evaluate(`(async (images) => {
            const drawn = await Promise.all(images.map(async ({ data, x, y }) => {
                const image = new Image();
                image.src = 'data:image/png;base64,' + data;
                await image.decode();
                return { image, x, y };
            }));
            const canvas = document.createElement('canvas');
            canvas.width = drawn[0].image.naturalWidth;
            canvas.height = drawn[0].image.naturalHeight;
            const context = canvas.getContext('2d');
            for (const { image, x, y } of drawn) context.drawImage(image, x * devicePixelRatio, y * devicePixelRatio);
            return canvas.toDataURL('image/png').split(',')[1];
        })(${JSON.stringify(images)})`);
        if (typeof png === 'string') fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(png, 'base64'));
    }

    // What `body`, an async function's, returns in the main process, by value, `require` and `webkit`, WebKit's
    // module, in its scope; what it threw as `{ error }`.
    async function main(body) {
        inMain ??= (async () => {
            const [target] = await (await fetch(`http://127.0.0.1:${port + 1}/json/list`)).json();
            const connection = await open(target.webSocketDebuggerUrl);
            // The module the app loaded: loaded again, it answers for the same pages.
            await evaluate(
                connection.send,
                `globalThis.deckitTestWebKit = (() => {
                    const loaded = { exports: {} };
                    process.dlopen(loaded, ${JSON.stringify(module)});
                    return loaded.exports;
                })(); true`
            );
            return connection;
        })();
        const { send } = await inMain;
        return evaluate(
            send,
            `(async (require, webkit) => { ${body} })(process.getBuiltinModule('module').createRequire(${JSON.stringify(
                module
            )}), globalThis.deckitTestWebKit)`
        );
    }

    // The web page WebKit shows by the id deck knows it by, its element's `data-web-page`: `evaluate(expression)` in
    // the page's own world, and `state()`, what the module says of it.
    function webPage(id) {
        // deckit-electron/web/webkit.js: deck's id of a page is the module's past 1 << 30.
        const native = Number(id) - (1 << 30);
        return {
            evaluate: async (expression) => {
                const json = await main(
                    `return webkit.evaluate(${native}, ${JSON.stringify(`return (${expression})`)})`
                );
                return typeof json === 'string' ? JSON.parse(json) : json;
            },
            state: () => main(`return webkit.state(${native})`),
        };
    }

    async function sessionOf(target) {
        if (sessions.has(target.id)) return sessions.get(target.id);
        // A page whose renderer went away is asked again through a new session.
        const { send, close } = await open(
            target.webSocketDebuggerUrl,
            (message) => {
                if (message.method !== 'Runtime.exceptionThrown') return;
                const details = message.params.exceptionDetails;
                thrown.push(`${target.url} ${details.exception?.description || details.text}`.slice(0, 400));
            },
            () => sessions.get(target.id) === session && sessions.delete(target.id)
        );
        const session = {
            url: target.url,
            send,
            evaluate: (expression) => evaluate(send, expression),
            async key(key, code, modifiers = 0, keyCode = 0) {
                for (const type of ['rawKeyDown', 'keyUp'])
                    await send('Input.dispatchKeyEvent', {
                        type,
                        key,
                        code,
                        modifiers,
                        windowsVirtualKeyCode: keyCode,
                        nativeVirtualKeyCode: keyCode,
                    });
            },
            async type(text) {
                await send('Input.insertText', { text });
            },
            // A click as a person makes it, through the input pipeline, at the middle of what `selector` finds.
            async press(selector) {
                const rect = await this.evaluate(
                    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`
                );
                for (const type of ['mousePressed', 'mouseReleased'])
                    await send('Input.dispatchMouseEvent', {
                        type,
                        x: rect.x,
                        y: rect.y,
                        button: 'left',
                        clickCount: 1,
                    });
            },
            // A drag as a person makes it, from the middle of what `from` evaluates to, an element, past the middle of
            // what `to` does, in small steps.
            async drag(from, to) {
                const middle = (expression) =>
                    this.evaluate(
                        `(() => { const r = (${expression}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, height: r.height }; })()`
                    );
                const start = await middle(from);
                const end = await middle(to);
                const mouse = (type, x, y) =>
                    send('Input.dispatchMouseEvent', {
                        type,
                        x,
                        y,
                        button: 'left',
                        buttons: type === 'mouseReleased' ? 0 : 1,
                        clickCount: 1,
                    });
                await mouse('mousePressed', start.x, start.y);
                const steps = 12;
                const y = end.y + end.height / 3;
                for (let step = 1; step <= steps; step++) {
                    await mouse('mouseMoved', start.x, start.y + ((y - start.y) * step) / steps);
                    await new Promise((resolve) => setTimeout(resolve, 16));
                }
                await mouse('mouseReleased', start.x, y);
            },
            // The page as a screenshot, clear where it draws nothing, in base64.
            async capture() {
                await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
                const shot = await send('Page.captureScreenshot', { format: 'png' });
                await send('Emulation.setDefaultBackgroundColorOverride');
                return shot.result?.data || '';
            },
            async shot(name) {
                const shot = await send('Page.captureScreenshot', { format: 'png' });
                if (shot.result?.data)
                    fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(shot.result.data, 'base64'));
            },
            close,
        };
        sessions.set(target.id, session);
        await send('Runtime.enable');
        return session;
    }

    const close = () => {
        for (const session of sessions.values()) session.close();
        inMain?.then(
            (connection) => connection.close(),
            () => {}
        );
    };

    return { targets, page, pages, compose, main, webPage, thrown, close };
}

// A connection to a DevTools protocol target at `url`: `send(method, params)` resolves to the answer, or to an error
// after 5 seconds; `heard(message)` gets what the target says unasked, and `closed()` is called once it is gone.
async function open(url, heard = () => {}, closed = () => {}) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => ((socket.onopen = resolve), (socket.onerror = reject)));
    socket.onclose = closed;
    let id = 0;
    const waiting = new Map();
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (!waiting.has(message.id)) return heard(message);
        waiting.get(message.id)(message);
        waiting.delete(message.id);
    };
    const send = (method, params = {}) =>
        new Promise((resolve) => {
            const n = ++id;
            waiting.set(n, resolve);
            setTimeout(() => waiting.delete(n) && resolve({ error: { message: method + ' timed out' } }), 5000);
            socket.send(JSON.stringify({ id: n, method, params }));
        });
    return { send, close: () => socket.close() };
}

// What `expression` comes to, awaited, by value; what it threw as `{ error }`.
async function evaluate(send, expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result?.exceptionDetails) return { error: result.result.exceptionDetails.exception?.description };
    return result.result?.result?.value;
}

module.exports = { connect, until, sleep, ALT, CTRL, META, SHIFT };
