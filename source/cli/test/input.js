// A seat's input in the environment of the app under test, asked of WebKit's module as the environment asks it: events
// put into a page that does not have the keyboard, beside a page that has it and is typed into as the machine's
// keyboard types; the machine's input as it is told; a press that leaves a reserved keyboard; and the page a press
// reaches, read from the layers laid, held against the one the host window hit tests.
const path = require('path');
const { pathToFileURL } = require('url');
const { sleep, until } = require('./devtools.js');

const HIT = pathToFileURL(path.join(__dirname, '..', '..', 'deckit', 'deckit-electron', 'stage', 'hit.js')).href;
const SEAT = 'seat-a';
const OTHER = 'seat-b';

// What a page keeps of the events it hears, each a word.
const WATCH = `(() => {
    const log = (window.deckitInputLog = []);
    const note = (e) => log.push([e.type, e.isTrusted ? '' : '!', e.key ?? '', e.buttons ?? '', e.detail ?? '',
        e.shiftKey ? 's' : '', e.repeat ? 'r' : ''].join(':'));
    window.deckitInputNote = note;
    for (const type of ${JSON.stringify(['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel', 'focusout', 'compositionend'])})
        document.addEventListener(type, note, true);
    window.addEventListener('blur', note);
    const style = 'position:fixed;left:24px;width:220px;z-index:99999;font:16px monospace;background:canvas;color:canvastext';
    const field = Object.assign(document.createElement('input'), { id: 'deckit-input-field' });
    field.style.cssText = style + ';top:96px';
    const rich = Object.assign(document.createElement('div'), { id: 'deckit-input-rich', contentEditable: 'true' });
    rich.style.cssText = style + ';top:136px;height:48px';
    const tall = Object.assign(document.createElement('div'), { id: 'deckit-input-tall' });
    tall.style.cssText = style + ';top:196px;height:60px;overflow:auto';
    tall.innerHTML = '<div style="height:600px">alpha beta gamma</div>';
    document.body.append(field, rich, tall);
    return true;
})()`;
const UNWATCH = `(() => {
    for (const id of ['field', 'rich', 'tall']) document.querySelector('#deckit-input-' + id)?.remove();
    return true;
})()`;

async function run({ check, main, laidNow, desktopLaid, windowsNow, windowOf, dockClick }) {
    const open = async (mod) => {
        if (!(await windowOf(mod))) await dockClick(mod);
        await until(async () => !!(await windowOf(mod)), 8000);
        await sleep(1000);
        return windowOf(mod);
    };
    const a = await open('mods');
    const b = await open('editor');
    if (!a || !b) return check('input: two windows are open to put input into', false, `${!!a} ${!!b}`);
    for (const page of [a, b]) await page.evaluate(WATCH);
    const put = async (page, event, from = SEAT) => {
        const answer = await main(`return webkit.putInput(${page.id}, ${JSON.stringify({ ...event, from })})`);
        await sleep(60);
        return answer;
    };
    const taken = (page) => page.evaluate(`window.deckitInputLog.splice(0).join(' ')`);
    const middle = (page, id) =>
        page.evaluate(`(() => { const r = document.querySelector('#deckit-input-${id}').getBoundingClientRect();
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const valueOf = (page, id = 'field') => page.evaluate(`document.querySelector('#deckit-input-${id}').value`);
    const textOf = (page) => page.evaluate(`document.querySelector('#deckit-input-rich').innerText`);
    const responder = async () =>
        (await laidNow())
            .flatMap(({ stages }) => stages)
            .flatMap(({ pages }) => pages)
            .find((page) => page.responder)?.id ?? null;
    const order = async () => (await windowsNow()).map(({ id, key }) => `${id}${key ? '*' : ''}`).join(',');
    const click = async (page, at, more = {}, from = SEAT) => {
        await put(page, { event: 'pointer', type: 'down', ...at, ...more }, from);
        await put(page, { event: 'pointer', type: 'up', ...at, ...more }, from);
    };
    const key = async (page, name, code, more = {}) => {
        await put(page, { event: 'key', type: 'down', key: name, code, ...more });
        await put(page, { event: 'key', type: 'up', key: name, code, ...more });
    };

    // The page with the machine's keyboard, typed into as the machine types.
    await a.press('#deckit-input-field');
    await a.key('a', 'KeyA');
    await sleep(200);
    const before = { responder: await responder(), order: await order() };
    check(
        'input: the page pressed as the machine presses has the keyboard',
        before.responder === a.id,
        before.responder
    );
    await taken(a);
    await taken(b);

    // A press put into the other page: the whole chain, trusted, and the keyboard and the order stay.
    const field = await middle(b, 'field');
    await click(b, field);
    const pressed = await taken(b);
    check(
        'input: a press put into a page is a trusted press there',
        /mousedown::[^ ]*:1:1/.test(pressed) &&
            /mouseup:/.test(pressed) &&
            /click::/.test(pressed) &&
            !/!/.test(pressed),
        pressed
    );
    const after = { responder: await responder(), order: await order() };
    check(
        'input: a press put into a page leaves the keyboard and the order of the windows',
        after.responder === a.id && after.order === before.order,
        JSON.stringify([before, after])
    );
    check(
        "input: a press put on a field focuses it in its page's document",
        await b.evaluate(`document.activeElement?.id === 'deckit-input-field'`),
        await b.evaluate(`document.activeElement?.id`)
    );

    // Keys, text and a composition put into a page that never had the keyboard, the machine typing meanwhile.
    await key(b, 'x', 'KeyX');
    await a.key('b', 'KeyB');
    await put(b, { event: 'text', type: 'insert', text: 'IN' });
    await key(b, 'Backspace', 'Backspace');
    await key(b, 'ArrowLeft', 'ArrowLeft');
    await key(b, 'y', 'KeyY');
    await a.key('c', 'KeyC');
    const edited = await valueOf(b);
    check('input: keys and text put into a field type and edit there', edited === 'xyI', edited);
    await put(b, { event: 'text', type: 'compose', text: '하' });
    await a.key('d', 'KeyD');
    const composing = await valueOf(b);
    await put(b, { event: 'text', type: 'compose', text: '한' });
    await put(b, { event: 'text', type: 'commit' });
    await put(b, { event: 'text', type: 'compose', text: 'zz' });
    await put(b, { event: 'text', type: 'cancel' });
    const composed = await valueOf(b);
    check(
        'input: a composition put into a field shows as it goes, commits and cancels',
        composing === 'xy하I' && composed === 'xy한I',
        `${composing} ${composed}`
    );
    await key(b, 'z', 'KeyZ', { repeat: true });
    await put(b, { event: 'key', type: 'down', key: 'Shift', code: 'ShiftLeft' });
    await key(b, 'Q', 'KeyQ', { modifiers: ['shift'] });
    await put(b, { event: 'key', type: 'up', key: 'Shift', code: 'ShiftLeft' });
    const keys = await taken(b);
    check(
        'input: a key put tells its repeat and a modifier its own key down and up',
        /keydown::z:[^ ]*:r/.test(keys) &&
            /keydown::Shift/.test(keys) &&
            /keyup::Shift/.test(keys) &&
            /keydown::Q:[^ ]*:s/.test(keys),
        keys
    );
    for (const letter of 'efghijklmnop') {
        await a.key(letter, `Key${letter.toUpperCase()}`);
        if (letter === 'h') await key(b, 'w', 'KeyW');
    }
    await sleep(200);
    const typed = { a: await valueOf(a), b: await valueOf(b), heard: await taken(a), responder: await responder() };
    check(
        'input: the page with the keyboard is typed into all the while, and never loses it',
        typed.a === 'abcdefghijklmnop' && !/blur|focusout/.test(typed.heard) && typed.responder === a.id,
        JSON.stringify({ ...typed, heard: typed.heard.slice(0, 200) })
    );

    // A key the page does not handle goes no further.
    await b.evaluate(`document.activeElement?.blur()`);
    for (const [name, code] of [
        ['w', 'KeyW'],
        ['Backspace', 'Backspace'],
        ['Escape', 'Escape'],
    ])
        await key(b, name, code);
    await sleep(300);
    const kept = await valueOf(a);
    check('input: a key a page does not handle reaches no other page', kept === 'abcdefghijklmnop', kept);

    // Text in editable content, a double click with a modifier, and a drag that selects.
    const rich = await middle(b, 'rich');
    await click(b, rich);
    await put(b, { event: 'text', type: 'insert', text: 'hello world' });
    await taken(b);
    await click(b, { x: rich.x - 80, y: rich.y - 12 });
    await click(b, { x: rich.x - 80, y: rich.y - 12 }, { count: 2 });
    const word = await b.evaluate(`getSelection().toString()`);
    await click(b, { x: rich.x - 30, y: rich.y - 12 }, { modifiers: ['shift'] });
    const doubled = await taken(b);
    check(
        'input: a press put tells its click count and its modifiers',
        /dblclick::[^ ]*:[^ ]*:2:/.test(doubled) && /mousedown::[^ ]*:1:1:s/.test(doubled),
        doubled
    );
    await put(b, { event: 'pointer', type: 'down', x: rich.x - 104, y: rich.y - 12 });
    for (const x of [-90, -70, -50, 400])
        await put(b, { event: 'pointer', type: 'move', x: rich.x + x, y: x === 400 ? -40 : rich.y - 12 });
    const dragging = await taken(b);
    await put(b, { event: 'pointer', type: 'up', x: rich.x - 50, y: rich.y - 12 });
    const dragged = await b.evaluate(`getSelection().toString()`);
    check(
        'input: a move put while a button is held is a drag, outside the page too',
        (dragging.match(/mousemove::[^ ]*:1:/g) || []).length === 4,
        dragging
    );
    check(
        'input: a double click and a drag put select text',
        word.trim() === 'hello' && dragged.length > 0,
        `${word}|${dragged}`
    );

    // Two seats each hold what they hold.
    await taken(a);
    await taken(b);
    await put(b, { event: 'pointer', type: 'down', x: rich.x, y: rich.y });
    await put(a, { event: 'pointer', type: 'down', x: 300, y: 300, button: 1 }, OTHER);
    await put(b, { event: 'pointer', type: 'move', x: rich.x + 10, y: rich.y });
    await put(a, { event: 'pointer', type: 'up', x: 300, y: 300, button: 1 }, OTHER);
    await put(b, { event: 'pointer', type: 'move', x: rich.x + 20, y: rich.y });
    await put(b, { event: 'pointer', type: 'up', x: rich.x + 20, y: rich.y });
    const held = { a: await taken(a), b: await taken(b) };
    check(
        'input: two seats hold a button at once, each its own',
        /mousedown::[^ ]*:4:/.test(held.a) &&
            (held.b.match(/mousemove::[^ ]*:1:/g) || []).length === 2 &&
            /mouseup::[^ ]*:0:/.test(held.b),
        JSON.stringify(held)
    );

    // A turn of the wheel scrolls what is under it. A move with no button held is put too, and a page hears none while
    // its window is not the one with the keyboard, as the engine has it for any pointer.
    await put(b, { event: 'pointer', type: 'move', x: rich.x, y: rich.y });
    const tall = await middle(b, 'tall');
    await put(b, { event: 'pointer', type: 'scroll', ...tall, dx: 0, dy: 40 });
    const scrolled = await until(
        () => b.evaluate(`document.querySelector('#deckit-input-tall').scrollTop === 40`),
        2000
    );
    const turned = await taken(b);
    check(
        'input: a turn of the wheel put into a page is a trusted wheel there and scrolls what is under it',
        /wheel::/.test(turned) && !/!/.test(turned) && scrolled,
        turned
    );

    // The machine's input as it is told, and none of what was put.
    await main(
        `globalThis.deckitTestInput = []; webkit.listenInput((name, event) => globalThis.deckitTestInput.push(event));`
    );
    const spot = await middle(a, 'field');
    await a.key('q', 'KeyQ');
    await main(
        `for (const type of ['down', 'dragged', 'up']) webkit.sendMouse(${a.id}, { type, x: ${spot.x}, y: ${spot.y} })`
    );
    await key(b, 'k', 'KeyK');
    await click(b, rich);
    const told = (await main(`return globalThis.deckitTestInput.splice(0)`)) || [];
    const words = told.map((event) =>
        [event.event, event.type, event.page, event.key ?? event.buttons?.join('+'), event.x ?? ''].join(':')
    );
    check(
        "input: the machine's keys and pointer are told with the page they are delivered to, and what is put is not",
        words.join(' ') ===
            [
                `key:down:${a.id}:q:`,
                `key:up:${a.id}:q:`,
                `pointer:down:${a.id}:0:${spot.x}`,
                `pointer:move:${a.id}:0:${spot.x}`,
                `pointer:up:${a.id}::${spot.x}`,
            ].join(' '),
        words.join(' ')
    );

    // A press of the machine's on a page whose keyboard is reserved reaches it and leaves the keyboard. The shell
    // gives the keyboard to the window the local seat pressed, so the window of `b` is pressed first, and the
    // keyboard handed to `a` under the shell.
    await b.press('#deckit-input-field');
    await sleep(200);
    await main(`return webkit.focus(${a.id})`);
    await sleep(100);
    await taken(b);
    await main(`return webkit.reserveKeyboard(${b.id}, true)`);
    await b.press('#deckit-input-field');
    await sleep(200);
    const reserved = { responder: await responder(), heard: await taken(b) };
    await main(`return webkit.reserveKeyboard(${b.id}, false)`);
    await b.press('#deckit-input-field');
    await sleep(200);
    const given = await responder();
    check(
        'input: a press on a page whose keyboard is reserved reaches it and leaves the keyboard',
        reserved.responder === a.id && /mousedown:/.test(reserved.heard) && given === b.id,
        JSON.stringify({ ...reserved, given })
    );
    for (const page of [a, b]) await page.evaluate(UNWATCH);

    // The page a press reaches, read from the layers, is the one the host window finds.
    const { hitIn } = await import(HIT);
    const laid = await desktopLaid();
    const layers = laid.pages.map(({ id, rect, clips, hidden, input }) => ({
        page: id,
        ...(hidden ? { hidden } : { frame: rect }),
        clips: clips.map((clip) => ({ ...clip.rect, cornerRadius: clip.radius })),
        input,
    }));
    const points = [];
    for (let x = 3; x < laid.rect.width; x += Math.floor(laid.rect.width / 24))
        for (let y = 3; y < laid.rect.height; y += Math.floor(laid.rect.height / 16)) points.push({ x, y });
    const at = points.map(({ x, y }) => ({ x: laid.rect.x + x, y: laid.rect.y + y }));
    const found = await main(`return ${JSON.stringify(at)}.map((point) => webkit.pageAt(${laid.window}, point))`);
    const differing = points.flatMap((point, index) => {
        const read = hitIn(layers, point)?.page ?? null;
        return read === (found[index] ?? null) ? [] : [`${point.x},${point.y}: ${read} != ${found[index]}`];
    });
    check(
        `input: the page a press reaches as read from the layers is the one the window finds, at ${points.length} points`,
        points.length > 300 && !differing.length,
        differing.slice(0, 6).join(' | ')
    );
    return undefined;
}

module.exports = { run };
