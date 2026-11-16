// A page read as structure in the environment of the app under test, asked of the reader every document runs through
// the environment's own module: the outline's size and time, a ref's life, what changed since a count, an element's
// place and caret, a web page read as a page of deckit's is, a wheel put into a document that scrolls, and a picture
// made of pages in an order that is not the one shown.
const path = require('path');
const { pathToFileURL } = require('url');
const { sleep } = require('./devtools.js');

const READ = pathToFileURL(path.join(__dirname, '..', '..', 'deckit', 'deckit-electron', 'read', 'main.js')).href;
const SEAT = 'seat-a';

// What a page is given to be read: a button, a field, editable content and a box that scrolls.
const GIVE = `(() => {
    const style = 'position:fixed;left:24px;width:220px;z-index:99999;font:16px monospace;background:canvas;color:canvastext';
    const make = (tag, id, top, more = '') => {
        const made = Object.assign(document.createElement(tag), { id: 'deckit-read-' + id });
        made.style.cssText = style + ';top:' + top + 'px;' + more;
        return made;
    };
    const button = make('button', 'button', 96);
    button.textContent = 'Alpha';
    const field = make('input', 'field', 136, 'padding:2px 6px;border:1px solid');
    field.setAttribute('aria-label', 'Probe');
    const rich = make('div', 'rich', 176, 'height:48px');
    rich.contentEditable = 'true';
    rich.setAttribute('aria-label', 'Rich');
    const tall = make('div', 'tall', 236, 'height:60px;overflow:auto');
    tall.innerHTML = '<div style="height:600px"></div><button id="deckit-read-far">Far</button>';
    document.body.append(button, field, rich, tall);
    return true;
})()`;
const TAKE = `(() => {
    for (const id of ['button', 'field', 'rich', 'tall']) document.querySelector('#deckit-read-' + id)?.remove();
    return true;
})()`;

// The environment's module over the app's pages, each asked through the app's main process: `read(method, id, ...rest)`
// answers what the reader of the page `id` does, or `{ refused }` with the code it refused with.
async function asked(main) {
    const { createRead } = await import(READ);
    const reader = createRead({ LOG: console });
    const pages = new Map();
    const pageOf = (id) => {
        if (!pages.has(id))
            pages.set(id, {
                id,
                isDestroyed: () => false,
                evaluate: async (source, world) => {
                    const json = await main(
                        `return webkit.evaluate(${id}, ${JSON.stringify(source)}, ${JSON.stringify(world)})`
                    );
                    if (typeof json !== 'string') throw new Error(String(json?.error));
                    return JSON.parse(json);
                },
            });
        return pages.get(id);
    };
    const read = async (method, id, ...rest) => {
        try {
            return await reader[method](pageOf(Number(id)), ...rest);
        } catch (error) {
            return { refused: error.code ?? String(error) };
        }
    };
    return read;
}

async function run({ check, main, open }) {
    const read = await asked(main);
    const put = async (page, event) => {
        const answer = await main(`return webkit.putInput(${page.id}, ${JSON.stringify({ ...event, source: SEAT })})`);
        await sleep(80);
        return answer;
    };
    const middle = (page, id) =>
        page.evaluate(`(() => { const r = document.querySelector('#deckit-read-${id}').getBoundingClientRect();
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const press = async (page, at) => {
        await put(page, { event: 'pointer', type: 'down', ...at });
        await put(page, { event: 'pointer', type: 'up', ...at });
    };
    const named = (lines, name) => lines?.find((line) => line.name === name);

    const settings = await open('settings');
    const mods = await open('mods');
    const editor = await open('editor');
    if (!settings || !mods || !editor) return check('read: three windows are open to read', false, '');

    // The reader is in every page, in deckit's world alone.
    const ids = await main(`return webkit.pages()`);
    const worlds = [];
    for (const id of ids) {
        const inWorld = (world) =>
            main(`return webkit.evaluate(${id}, 'return typeof globalThis.deckitReader', ${JSON.stringify(world)})
                .then((json) => JSON.parse(json), () => 'none')`);
        worlds.push(`${await inWorld('deckit')}/${await inWorld('page')}`);
    }
    check(
        `read: every page's document has the reader, in a world its own scripts do not see, ${ids.length} pages`,
        ids.length > 3 && worlds.every((world) => world === 'object/undefined'),
        worlds.join(' ')
    );

    // S0's sizes and times as bounds.
    const whole = await read('outline', settings.id, { all: true });
    const seen = await read('outline', settings.id);
    const inPage = await settings.evaluate(
        `(() => { const start = performance.now(); for (let run = 0; run < 20; run++) deckitReader.outline();
            return (performance.now() - start) / 20; })()`,
        'deckit'
    );
    const began = Date.now();
    for (let run = 0; run < 10; run++) await read('outline', settings.id);
    const round = (Date.now() - began) / 10;
    const text = (seen.lines ?? []).map((line) => `${line.role} ${line.name ?? ''}`).join(' | ');
    console.log(
        `[read] settings: ${seen.lines?.length} lines in view, ${whole.lines?.length} whole, ` +
            `${JSON.stringify(seen).length} chars as data, ${inPage.toFixed(2)} ms in the page, ${round.toFixed(1)} ms asked`
    );
    check(
        "read: Settings' outline in view is some thirty lines, each with a ref, and its whole document more",
        seen.lines?.length >= 15 &&
            seen.lines.length <= 60 &&
            seen.lines.every((line) => /^\d+\.\d+$/.test(line.ref)) &&
            whole.lines?.length > seen.lines.length &&
            seen.width > 0,
        `${seen.lines?.length} of ${whole.lines?.length}: ${text.slice(0, 400)}`
    );
    check('read: the outline in view is read in under 5 ms in its page', inPage < 5, `${inPage}`);
    const buttons = await read('outline', settings.id, { roles: ['button'], depth: 30 });
    check(
        'read: an outline of some roles has their lines and those that hold them alone',
        buttons.lines?.some((line) => line.role === 'button') &&
            buttons.lines.length <= seen.lines.length &&
            buttons.lines.every((line, at) => line.role === 'button' || buttons.lines[at + 1]?.depth > line.depth),
        `${buttons.lines?.length} of ${seen.lines?.length}: ${buttons.lines?.map((line) => `${line.depth} ${line.role}`).join(', ')}`
    );

    // A ref's life.
    await editor.evaluate(GIVE);
    await sleep(100);
    const first = await read('outline', editor.id);
    const alpha = named(first.lines, 'Alpha');
    await editor.evaluate(`(() => { const button = document.querySelector('#deckit-read-button');
        button.textContent = 'Beta'; button.setAttribute('aria-pressed', 'true'); return true; })()`);
    const second = await read('outline', editor.id);
    const beta = named(second.lines, 'Beta');
    check(
        'read: a ref names its element across a new drawing of it',
        !!alpha && beta?.ref === alpha.ref && beta.states.includes('pressed') && second.document === first.document,
        `${JSON.stringify(alpha)} ${JSON.stringify(beta)}`
    );

    // What changed since a count: a typed line is one entry.
    await press(editor, await middle(editor, 'field'));
    const before = await read('outline', editor.id);
    const probe = named(before.lines, 'Probe');
    await put(editor, { event: 'text', type: 'insert', text: 'hello world' });
    const typed = await read('changes', editor.id, { document: before.document, count: before.count });
    check(
        'read: a line typed into a field is one change, the field as it reads now',
        typed.entries?.length === 1 &&
            typed.entries[0].kind === '~' &&
            typed.entries[0].ref === probe?.ref &&
            typed.entries[0].states.includes('value "hello world"') &&
            typed.entries[0].states.includes('focused') &&
            typed.count > before.count,
        JSON.stringify(typed)
    );
    const none = await read('changes', editor.id, { document: typed.document, count: typed.count });
    check(
        'read: nothing changed since the last count reads as no entry',
        none.entries?.length === 0,
        JSON.stringify(none)
    );

    // Lines no answer listed yet are told as added only once they came: a change of text beside them tells none.
    await editor.evaluate(`(() => { const quiet = document.createElement('div'); quiet.id = 'deckit-read-quiet';
        quiet.innerHTML = '<button>Quiet one</button><span id="deckit-read-quiet-text">q</span>'
            + '<button>Quiet two</button>';
        document.body.append(quiet); return true; })()`);
    await sleep(100);
    const quiet = await read('node', editor.id, probe?.ref);
    await editor.evaluate(`(() => { document.querySelector('#deckit-read-quiet-text').textContent = 'r';
        document.querySelector('#deckit-read-quiet').append(Object.assign(document.createElement('button'),
            { textContent: 'Quiet three' })); return true; })()`);
    const came = await read('changes', editor.id, { document: before.document, count: quiet.count });
    await editor.evaluate(`document.querySelector('#deckit-read-quiet').remove()`);
    const quietTold = (came.entries ?? []).map(({ kind, name }) => `${kind} ${name}`);
    check(
        'read: a line no answer listed is told added as it comes, and not as text beside it changes',
        quietTold.includes('+ Quiet three') && !quietTold.some((each) => /Quiet (one|two)/.test(each)),
        JSON.stringify(came).slice(0, 400)
    );

    // The caret in a field of one line and in editable content.
    const field = await read('node', editor.id, probe?.ref);
    const expected = await editor.evaluate(`(() => {
        const field = document.querySelector('#deckit-read-field');
        const span = document.createElement('span');
        span.style.cssText = 'position:fixed;visibility:hidden;white-space:pre;font:16px monospace';
        span.textContent = field.value;
        document.body.append(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        const rect = field.getBoundingClientRect();
        return { x: rect.x + 1 + 6 + width, top: rect.y, bottom: rect.bottom };
    })()`);
    check(
        "read: a field's node has its selection and where its caret is drawn",
        field.selection?.start === 11 &&
            field.selection.end === 11 &&
            Math.abs(field.caret?.x - expected.x) <= 2 &&
            field.caret.y >= expected.top &&
            field.caret.y + field.caret.height <= expected.bottom + 1 &&
            field.rect?.width > 200,
        `${JSON.stringify(field)} ${JSON.stringify(expected)}`
    );
    // What is selected, as rects: a part of a field's value, then nothing.
    const part = await editor.evaluate(`(() => {
        const field = document.querySelector('#deckit-read-field');
        field.setSelectionRange(2, 7);
        const span = document.createElement('span');
        span.style.cssText = 'position:fixed;visibility:hidden;white-space:pre;font:16px monospace';
        span.textContent = field.value.slice(0, 2);
        document.body.append(span);
        const before = span.getBoundingClientRect().width;
        span.textContent = field.value.slice(2, 7);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return { x: field.getBoundingClientRect().x + 1 + 6 + before, width };
    })()`);
    const partly = await read('node', editor.id, probe?.ref);
    await editor.evaluate(`document.querySelector('#deckit-read-field').setSelectionRange(11, 11)`);
    check(
        "read: a field's node has the rect its selected text is drawn at, and none with nothing selected",
        partly.selected?.length === 1 &&
            Math.abs(partly.selected[0].x - part.x) <= 2 &&
            Math.abs(partly.selected[0].width - part.width) <= 2 &&
            partly.selected[0].y === partly.caret?.y &&
            partly.selected[0].height === partly.caret.height &&
            field.selected === undefined,
        `${JSON.stringify(partly)} ${JSON.stringify(part)}`
    );
    // A value is written as a name is: what would end the state too early is escaped.
    const swap = (value) =>
        editor.evaluate(`(() => {
            const field = document.querySelector('#deckit-read-field');
            const had = field.value;
            field.value = ${JSON.stringify(value)};
            return had;
        })()`);
    const had = await swap('say "a", b\\c');
    const escaped = named((await read('outline', editor.id)).lines, 'Probe');
    await swap(had);
    check(
        "read: a field's value is escaped as a name is",
        escaped?.states.includes('value "say \\"a\\", b\\\\c"'),
        JSON.stringify(escaped)
    );
    await press(editor, await middle(editor, 'rich'));
    await put(editor, { event: 'text', type: 'insert', text: 'one two' });
    const rich = await read('node', editor.id, named((await read('outline', editor.id)).lines, 'Rich')?.ref);
    check(
        "read: editable content's node has its text as lines, its selection and its caret",
        rich.lines?.[0]?.role === 'text' &&
            rich.lines[0].name === 'one two' &&
            rich.selection?.line === 1 &&
            rich.selection.column === 7 &&
            rich.caret?.x > rich.rect.x &&
            rich.caret.x < rich.rect.x + rich.rect.width &&
            rich.line.states.includes('text 7'),
        JSON.stringify(rich)
    );

    // What is selected in editable content, a line of text broken in two: a rect a line, top to bottom.
    const broken = await editor.evaluate(`(() => {
        const rich = document.querySelector('#deckit-read-rich');
        const text = rich.firstChild;
        rich.append(document.createElement('br'), 'three');
        getSelection().setBaseAndExtent(text, 4, rich.lastChild, 3);
        const rects = [[text, 4, 7], [rich.lastChild, 0, 3]].map(([node, from, to]) => {
            const range = document.createRange();
            range.setStart(node, from);
            range.setEnd(node, to);
            const { x, y, width, height } = range.getBoundingClientRect();
            return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
        });
        return { rects, text: rich.textContent };
    })()`);
    const across = await read('node', editor.id, named((await read('outline', editor.id)).lines, 'Rich')?.ref);
    await editor.evaluate(`(() => {
        const rich = document.querySelector('#deckit-read-rich');
        rich.lastChild.remove();
        rich.lastChild.remove();
        getSelection().collapse(rich.firstChild, 7);
    })()`);
    check(
        "read: editable content's node has a rect for each line of what is selected, and none with nothing selected",
        JSON.stringify(across.selected) === JSON.stringify(broken.rects) &&
            across.selected.length === 2 &&
            across.selected[1].y > across.selected[0].y &&
            rich.selected === undefined,
        `${JSON.stringify(across)} ${JSON.stringify(broken)}`
    );

    // A node whose element has no role still stands as the first line, what it holds one level under it.
    await editor.evaluate(`(() => {
        const aside = Object.assign(document.createElement('div'), { id: 'deckit-read-aside', textContent: 'Aside' });
        aside.setAttribute('role', 'note');
        aside.style.cssText = 'position:fixed;left:24px;top:320px;width:220px;height:24px;z-index:99999';
        document.body.append(aside);
    })()`);
    const note = (await read('outline', editor.id)).lines?.find((line) => line.role === 'note');
    await editor.evaluate(`document.querySelector('#deckit-read-aside').removeAttribute('role')`);
    const bare = await read('node', editor.id, note?.ref);
    await editor.evaluate(`document.querySelector('#deckit-read-aside').remove()`);
    check(
        'read: the node of an element with no role reads as generic, its text one level under it',
        bare.line?.role === 'generic' &&
            bare.line.depth === 0 &&
            bare.lines?.length === 1 &&
            bare.lines[0].role === 'text' &&
            bare.lines[0].name === 'Aside' &&
            bare.lines[0].depth === 1,
        JSON.stringify(bare)
    );

    // An element's place, once it is in view.
    const far = named((await read('outline', editor.id, { all: true })).lines, 'Far');
    const hidden = named((await read('outline', editor.id)).lines, 'Far');
    const placed = await read('place', editor.id, far?.ref);
    const box = await editor.evaluate(`(() => { const tall = document.querySelector('#deckit-read-tall');
        const r = tall.getBoundingClientRect(); return { top: r.y, bottom: r.bottom, scrolled: tall.scrollTop }; })()`);
    check(
        'read: an element out of view is not in the outline in view, and its place is where it is once scrolled to',
        !!far && !hidden && placed.y >= box.top && placed.y + placed.height <= box.bottom + 1 && box.scrolled > 0,
        `${JSON.stringify(far)} ${JSON.stringify(placed)} ${JSON.stringify(box)}`
    );

    // Gone.
    await editor.evaluate(`document.querySelector('#deckit-read-button').remove()`);
    const gone = await read('node', editor.id, alpha?.ref);
    const nowhere = await read('place', editor.id, alpha?.ref);
    const removed = await read('changes', editor.id, { document: before.document, count: typed.count });
    const other = await read('node', editor.id, `${first.document + 1000}.1`);
    check(
        'read: a ref of an element removed, or of another document, is refused as gone, and told as a change',
        gone.refused === 'GONE' &&
            nowhere.refused === 'GONE' &&
            other.refused === 'GONE' &&
            removed.entries?.some((entry) => entry.kind === '-' && entry.ref === alpha?.ref),
        `${JSON.stringify(gone)} ${JSON.stringify(nowhere)} ${JSON.stringify(other)} ${JSON.stringify(removed).slice(0, 300)}`
    );

    // A count however old is answered: each element is kept with the last count it changed at.
    const counts = await editor.evaluate(
        `(async () => { const field = document.querySelector('#deckit-read-field');
            const { key, count } = deckitReader.outline();
            for (let turn = 0; turn < 300; turn++) {
                field.setAttribute('data-turn', turn);
                await null;
                deckitReader.changes(key, deckitReader.outline().count);
            }
            return { from: count, to: deckitReader.outline().count }; })()`,
        'deckit'
    );
    const old = await read('changes', editor.id, { document: before.document, count: typed.count });
    const fresh = await read('changes', editor.id, { document: before.document, count: counts.to - 10 });
    const never = await read('changes', editor.id, { document: before.document, count: counts.to + 5 });
    check(
        'read: changes since a count 300 counts old are answered, and since one the document never had refused stale',
        counts.to - counts.from >= 300 &&
            old.entries?.length >= 1 &&
            fresh.entries?.length === 1 &&
            never.refused === 'STALE',
        `${JSON.stringify(counts)} ${JSON.stringify(old).slice(0, 200)} ${JSON.stringify(fresh).slice(0, 200)}`
    );
    await editor.evaluate(TAKE);

    // A wheel put into a document that scrolls itself.
    const size = await mods.evaluate(`(() => { const html = document.documentElement, body = document.body;
        window.deckitReadKept = [html.style.cssText, body.style.cssText];
        html.style.cssText += ';overflow:auto;height:auto';
        body.style.cssText += ';overflow:visible;height:4000px;min-height:4000px';
        return { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2), tall: html.scrollHeight - html.clientHeight }; })()`);
    await sleep(200);
    await put(mods, { event: 'pointer', type: 'scroll', x: size.x, y: size.y, dx: 0, dy: 60 });
    await sleep(300);
    const scrolled = await mods.evaluate(`(() => { const y = scrollY;
        scrollTo(0, 0);
        [document.documentElement.style.cssText, document.body.style.cssText] = window.deckitReadKept;
        return y; })()`);
    check(
        "read: a wheel put into a page scrolls its document's own scroller",
        scrolled > 0,
        `${JSON.stringify(size)} ${scrolled}`
    );

    // A web page a mod shows.
    const browser = await open('browser');
    const web = await browser?.evaluate(
        `[...document.querySelectorAll('[data-web-page]')].find((element) => element.style.visibility === 'visible')?.dataset.webPage`
    );
    if (web) {
        const state = await main(`return webkit.state(${Number(web)})`);
        const page = await read('outline', Number(web), { all: true });
        console.log(
            `[read] the web page at ${state?.url}: ${page.lines?.length} lines, ${JSON.stringify(page).slice(0, 300)}`
        );
        check(
            'read: a web page a mod shows is read as a page of deckit is',
            Array.isArray(page.lines) && page.width > 0,
            JSON.stringify(page).slice(0, 300)
        );
    } else console.log('[read] the browser shows no web page: none read');

    // A picture of pages in two orders, and its cost at the desktop's size.
    const sizeOf = (page) => page.evaluate(`({ width: innerWidth, height: innerHeight })`);
    const a = { page: mods.id, frame: { x: 0, y: 0, ...(await sizeOf(mods)) } };
    const b = { page: editor.id, frame: { x: 0, y: 0, ...(await sizeOf(editor)) } };
    const rect = { x: 40, y: 40, width: 200, height: 160 };
    const pictures = await main(`const { nativeImage } = require('electron');
        const sample = async (layers) => {
            const image = nativeImage.createFromBuffer(Buffer.from(await webkit.capture(layers, ${JSON.stringify({ rect, scale: 1 })}), 'base64'));
            const { width, height } = image.getSize();
            const bitmap = image.toBitmap();
            const points = [];
            for (let y = 4; y < height; y += 8)
                for (let x = 4; x < width; x += 8) points.push(bitmap.readUInt32LE((y * width + x) * 4));
            return { width, height, points };
        };
        const [a, b] = ${JSON.stringify([a, b])};
        const all = [a, b, a, b, a, b];
        const began = Date.now();
        const whole = await webkit.capture(all, { rect: { x: 0, y: 0, width: 1440, height: 900 }, scale: 1 });
        const took = Date.now() - began;
        return { a: await sample([a]), b: await sample([b]), ab: await sample([a, b]), ba: await sample([b, a]),
            took, bytes: whole.length * 0.75, pages: all.length };`);
    const { a: onlyA, b: onlyB, ab, ba } = pictures;
    const opaque = (value) => value >>> 24 === 255;
    const unlike = (top, drawn) => top.points.filter((value, at) => opaque(value) && value !== drawn.points[at]).length;
    const told = [
        onlyA?.points.filter((value, at) => value !== onlyB.points[at]).length,
        onlyA?.points.filter(opaque).length,
        onlyB?.points.filter(opaque).length,
        unlike(onlyB, ab),
        unlike(onlyA, ba),
        onlyB?.points.filter((value, at) => value === 0 && ab.points[at] !== onlyA.points[at]).length,
    ];
    console.log(
        `[read] a picture of ${pictures.pages} pages at 1440x900: ${pictures.took} ms, ${Math.round(pictures.bytes)} bytes`
    );
    check(
        'read: a picture of pages laid in an order draws each as laid, the one under whole',
        onlyA?.width === rect.width &&
            onlyA.height === rect.height &&
            told[0] > 20 &&
            told[1] > 20 &&
            told[2] > 20 &&
            told[3] === 0 &&
            told[4] === 0 &&
            told[5] === 0,
        `${told.join(' ')} of ${onlyA?.points.length}`
    );
    return undefined;
}

module.exports = { run, asked };
