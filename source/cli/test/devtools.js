// A client of the DevTools protocol for the app under test: its pages, each a session that evaluates, presses, types
// and takes screenshots, and what any page threw while it was watched.
const fs = require('fs');
const path = require('path');

// Modifiers: alt 1, ctrl 2, meta 4, shift 8.
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

function connect({ port, shots }) {
    const sessions = new Map();
    const thrown = [];

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
        if (!target) return null;
        if (sessions.has(target.id)) return sessions.get(target.id);
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => ((socket.onopen = resolve), (socket.onerror = reject)));
        let id = 0;
        const waiting = new Map();
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.method === 'Runtime.exceptionThrown') {
                const details = message.params.exceptionDetails;
                thrown.push(`${target.url} ${details.exception?.description || details.text}`.slice(0, 400));
            }
            if (waiting.has(message.id)) {
                waiting.get(message.id)(message);
                waiting.delete(message.id);
            }
        };
        const send = (method, params = {}) =>
            new Promise((resolve) => {
                const n = ++id;
                waiting.set(n, resolve);
                setTimeout(() => waiting.delete(n) && resolve({ error: { message: method + ' timed out' } }), 5000);
                socket.send(JSON.stringify({ id: n, method, params }));
            });
        const session = {
            url: target.url,
            send,
            async evaluate(expression) {
                const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
                if (result.result?.exceptionDetails)
                    return { error: result.result.exceptionDetails.exception?.description };
                return result.result?.result?.value;
            },
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
            async shot(name) {
                const shot = await send('Page.captureScreenshot', { format: 'png' });
                if (shot.result?.data)
                    fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(shot.result.data, 'base64'));
            },
            close: () => socket.close(),
        };
        sessions.set(target.id, session);
        await send('Runtime.enable');
        return session;
    }

    const close = () => {
        for (const session of sessions.values()) session.close();
    };

    return { targets, page, thrown, close };
}

module.exports = { connect, until, sleep, CTRL, META, SHIFT };
