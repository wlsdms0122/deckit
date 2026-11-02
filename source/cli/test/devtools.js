// A client of the app under test through its main process's inspector, the DevTools protocol's, and WebKit's module
// in it: its pages, each a session that evaluates, presses, types and takes snapshots, what any page threw while it
// was watched, its main process, and the web pages it shows.
const fs = require('fs');
const path = require('path');

// Modifiers: alt 1, ctrl 2, meta 4, shift 8.
const ALT = 1;
const CTRL = 2;
const META = 4;
const SHIFT = 8;
// How often what the watched pages threw is gathered.
const GATHER = 500;
// Where a watched page keeps what it threw until it is gathered.
const THROWN = "Symbol.for('deckit-test:thrown')";

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

// `port` is the main process's inspector's, and `module` the path of WebKit's module (deckit-web.node).
function connect({ port, shots, module }) {
    const sessions = new Map(); // page id -> session
    const thrown = [];
    let inMain = null;
    const gathering = setInterval(gather, GATHER);

    // Every page open: { id, url }.
    async function targets() {
        const found = await main(`return webkit.pages().map((id) => ({ id, url: webkit.state(id).url }))`);
        return Array.isArray(found) ? found : [];
    }

    // The session of the first page whose address starts with `match`, or null.
    async function page(match) {
        const target = (await targets()).find((candidate) => candidate.url.startsWith(match));
        return target ? sessionOf(target) : null;
    }

    // The sessions of every page whose address starts with `match`.
    async function pages(match) {
        return Promise.all((await targets()).filter((candidate) => candidate.url.startsWith(match)).map(sessionOf));
    }

    // Pages laid one over another, as they are in a window, drawn into one image: `layers` from the bottom, each {
    // session, x, y }, its place in the window. Each is taken clear where it draws nothing.
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

    // The session of the overlay `opener`'s page opened beside it (deckit-shell/shell/overlay), or null.
    async function overlayOf(opener) {
        if (!opener) return null;
        for (const target of (await targets()).filter((candidate) => candidate.url === 'about:blank')) {
            const session = await sessionOf(target);
            const of = await session.evaluate(`window.name === 'deckit-overlay' && window.opener?.location.href`);
            if (typeof of === 'string' && of.startsWith(opener.url)) return session;
        }
        return null;
    }

    // What `body`, an async function's, returns in the main process, by value, `require` and `webkit`, WebKit's
    // module, in its scope; what it threw as `{ error }`.
    async function main(body) {
        inMain ??= (async () => {
            const [target] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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

    // What `expression` comes to in page `id`'s `world`, its own (`page`) or deckit's (`deckit`), awaited, by value;
    // what it threw as `{ error }`. Statements that are no expression are run, and come to nothing.
    async function evaluateIn(id, expression, world = 'page') {
        const returned = `return (\n${expression}\n)`;
        const source = parses(returned) ? returned : expression;
        const json = await main(`return webkit.evaluate(${id}, ${JSON.stringify(source)}, ${JSON.stringify(world)})`);
        return typeof json === 'string' ? JSON.parse(json) : json;
    }

    // The web page WebKit shows by the id deck knows it by, its element's `data-web-page`: `evaluate(expression)` in
    // the page's own world, and `state()`, what the module says of it.
    function webPage(id) {
        return {
            evaluate: (expression) => evaluateIn(Number(id), expression),
            state: () => main(`return webkit.state(${Number(id)})`),
        };
    }

    async function sessionOf({ id, url }) {
        if (sessions.has(id)) return sessions.get(id);
        // Input the module refuses, as for a page off screen, is said and goes nowhere.
        const send = async (type, options) => {
            const answer = await main(`return webkit.${type}(${id}, ${JSON.stringify(options)})`);
            if (answer?.error) console.error(`[test] ${type} in ${url}: ${answer.error}`);
            return answer;
        };
        const mouse = (type, { x, y }) => send('sendMouse', { type, x, y });
        const session = {
            url,
            evaluate: (expression, world) => evaluateIn(id, expression, world),
            async key(key, code, modifiers = 0) {
                await send('sendKey', {
                    code,
                    key,
                    alt: !!(modifiers & ALT),
                    ctrl: !!(modifiers & CTRL),
                    meta: !!(modifiers & META),
                    shift: !!(modifiers & SHIFT),
                });
            },
            // Typed into what has the keyboard in the page, as an input method enters text.
            async type(text) {
                await this.evaluate(`document.execCommand('insertText', false, ${JSON.stringify(text)})`);
            },
            // A click as a person makes it, through the app's events, at the middle of what `selector` finds.
            async press(selector) {
                const at = await this.evaluate(
                    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`
                );
                await mouse('down', at);
                await mouse('up', at);
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
                await mouse('down', start);
                const steps = 12;
                const y = end.y + end.height / 3;
                for (let step = 1; step <= steps; step++) {
                    await mouse('dragged', { x: start.x, y: start.y + ((y - start.y) * step) / steps });
                    await sleep(16);
                }
                await mouse('up', { x: start.x, y });
            },
            // The page's content process ended, as a crash ends it.
            crash: () => main(`return webkit.killProcess(${id})`),
            reload: () => main(`return webkit.go(${id}, 'reload')`),
            // What the page draws, clear where it draws nothing, a PNG in base64.
            async capture() {
                const png = await main(`return webkit.snapshot(${id})`);
                return typeof png === 'string' ? png : '';
            },
            async shot(name) {
                const png = await this.capture();
                if (png) fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(png, 'base64'));
            },
        };
        sessions.set(id, session);
        await watch(session);
        return session;
    }

    // What the page throws from now on, kept in it until it is gathered; again after it loads anew.
    function watch(session) {
        return session.evaluate(`(() => {
            const kept = globalThis[${THROWN}] ??= [];
            if (kept.watched) return true;
            kept.watched = true;
            addEventListener('error', (event) => kept.push(String(event.error?.stack || event.message)));
            addEventListener('unhandledrejection', (event) => kept.push(String(event.reason?.stack || event.reason)));
            return true;
        })()`);
    }

    async function gather() {
        for (const session of sessions.values()) {
            const taken = await session.evaluate(`globalThis[${THROWN}]?.splice(0) ?? null`);
            if (Array.isArray(taken)) for (const text of taken) thrown.push(`${session.url} ${text}`.slice(0, 400));
            if (taken === null) await watch(session);
        }
    }

    const close = () => {
        clearInterval(gathering);
        inMain?.then(
            (connection) => connection.close(),
            () => {}
        );
    };

    return { targets, page, pages, overlayOf, compose, main, webPage, thrown, close };
}

// A connection to a DevTools protocol target at `url`: `send(method, params)` resolves to the answer, or to an error
// after 5 seconds.
async function open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => ((socket.onopen = resolve), (socket.onerror = reject)));
    let id = 0;
    const waiting = new Map();
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        waiting.get(message.id)?.(message);
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

// Whether `body` is an async function's body, as the module runs what it evaluates.
function parses(body) {
    try {
        new (async () => {}).constructor(body);
        return true;
    } catch {
        return false;
    }
}

// What `expression` comes to, awaited, by value; what it threw as `{ error }`.
async function evaluate(send, expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result?.exceptionDetails) return { error: result.result.exceptionDetails.exception?.description };
    return result.result?.result?.value;
}

module.exports = { connect, until, sleep, ALT, CTRL, META, SHIFT };
