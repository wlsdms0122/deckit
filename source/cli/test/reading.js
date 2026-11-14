// What a seat reads of the app under test through `deckit seat`: the desktop, a window, a node, what changed since a
// mark, a picture, and the watch, each as the terminal prints it. `reader` is the seat that reads and acts, key in
// the window `window` at the field of its page `page`, `other` a second seat, and `editor` the Editor's window.
const fs = require('fs');
const path = require('path');
const { sleep, until } = require('./devtools.js');

const WINDOW = /^(window|panel) w\d+ "[^"]*" \S+( (top|bottom|left|right))? at -?\d+,-?\d+ \d+x\d+( \[[^\]]+\])?$/;
const sizeOfPng = (file) => {
    const png = fs.readFileSync(file);
    return png.subarray(1, 4).toString() === 'PNG' ? `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}` : null;
};

async function run({ check, reader, other, window, editor, showsFor, inPage, page, field, folder, watch }) {
    const desktop = reader.as('read', 'desktop').split('\n');
    const [, size] = /^desktop (\d+x\d+) mark \d+$/.exec(desktop[0]) ?? [];
    const items = Number(/^dock \((\d+) items\)$/.exec(desktop.find((line) => line.startsWith('dock ')))?.[1]);
    const seats = desktop.filter((line) => line.startsWith('seat '));
    const windows = desktop.filter((line) => WINDOW.test(line));
    const own = `window w${window.id} "[^"]*" ${window.mod} at -?\\d+,-?\\d+ (\\d+x\\d+) \\[key ${reader.seat}\\]`;
    const [, frame] = new RegExp(`^${own}$`).exec(windows[0]) ?? [];
    check(
        'reading: the desktop reads as its seats, the Dock and the windows, the asking seat marked and its window first',
        size &&
            seats[0].startsWith('seat local "Deckit"') &&
            seats.some((line) =>
                new RegExp(`^seat ${reader.seat} "Second" at \\d+,\\d+ key w${window.id} \\(you\\)$`).test(line)
            ) &&
            seats.some((line) => new RegExp(`^seat ${other.seat} "First"( at \\d+,\\d+)?( key w\\d+)?$`).test(line)) &&
            desktop.filter((line) => /^ {2}item "[^"]+"( \[[a-z, ]+\])? dock\.\S+$/.test(line)).length === items &&
            !!frame &&
            desktop.length === 1 + seats.length + 1 + items + windows.length,
        desktop.join('\n')
    );

    const outline = reader.as('read', 'window', `w${window.id}`).split('\n');
    const [, ref] =
        new RegExp(`^ +textbox \\[focused ${reader.seat}, value "beta"\\] (\\d+\\.\\d+)$`, 'm').exec(
            outline.join('\n')
        ) ?? [];
    check(
        'reading: a window reads as its line, its buttons and its documents, the field naming the seat that types in it',
        new RegExp(`^${own} mark \\d+$`).test(outline[0]) &&
            outline[1] === `  button "Close" w${window.id}.close` &&
            outline.some((line) => /^ {2}document \d+ content \d+x\d+$/.test(line)) &&
            outline.some((line) => /^ {2}document \d+ child "region-child" \d+x\d+$/.test(line)) &&
            !!ref,
        outline.join('\n')
    );
    const node = reader.as('read', 'node', String(ref)).split('\n');
    const asData = JSON.parse(reader.as('read', 'node', String(ref), '--json'));
    check(
        'reading: a node reads as its line with its place on the desktop and what is under it, and the same as data',
        new RegExp(`^textbox \\[focused ${reader.seat}, value "beta"\\] ${ref} at \\d+,\\d+ \\d+x\\d+$`).test(
            node[0]
        ) &&
            node.at(-1) === '  selection 4' &&
            asData?.node?.ref === ref &&
            `${asData.rect.x},${asData.rect.y}` === /at (\d+,\d+)/.exec(node[0])[1],
        JSON.stringify({ node, asData })
    );

    reader.as('type', '!');
    await sleep(400);
    const changed = reader.as('changes');
    check(
        'reading: what changed after a typed line is one line',
        new RegExp(`^changes \\d+ to \\d+\\n~ textbox \\[focused ${reader.seat}, value "beta!"\\] ${ref}$`).test(
            changed
        ),
        changed
    );
    const stale = reader.as('changes', '99999999');
    check('reading: a mark the desktop never had is refused', /not kept: read again/.test(stale), stale);

    await inPage(
        page,
        `(() => {
        document.querySelector('#${field}').addEventListener('mousedown', () => (window.deckitRead = (window.deckitRead ?? 0) + 1));
        return true;
    })()`
    );
    reader.as('move', '2,300');
    const acted = reader.as('press', String(ref));
    const pointer = /at (\d+),(\d+)/.exec(
        reader
            .as('read', 'desktop')
            .split('\n')
            .find((line) => line.includes('(you)'))
    );
    const inField =
        asData?.rect &&
        pointer &&
        ['x', 'y'].every((axis, at) => {
            const from = asData.rect[axis];
            return (
                Number(pointer[at + 1]) >= from &&
                Number(pointer[at + 1]) <= from + asData.rect[axis === 'x' ? 'width' : 'height']
            );
        });
    check(
        'reading: a press on a ref moves the pointer of the seat into what it names and presses there',
        acted === `over ${window.id}, key` && inField && (await inPage(page, 'window.deckitRead')) === 1,
        JSON.stringify({ acted, pointer, rect: asData?.rect })
    );

    const whole = path.join(folder, 'reading-desktop.png');
    const one = path.join(folder, 'reading-window.png');
    const captured = [
        reader.as('capture', '--out', whole),
        reader.as('capture', 'window', `w${window.id}`, '--out', one),
    ];
    check(
        'reading: a picture of the desktop and of a window is a PNG of that size',
        captured[0] === `${whole} ${size}` &&
            sizeOfPng(whole) === size &&
            captured[1] === `${one} ${frame}` &&
            sizeOfPng(one) === frame,
        JSON.stringify(captured)
    );

    const watching = watch(reader);
    await sleep(1500);
    reader.as('type', '?');
    const told = await until(() => /^~ textbox .*value "beta!\?"/m.test(watching.said()), 5000);
    watching.stop();
    check('reading: a seat that watches is told a line as the desktop changes', !!told, watching.said());

    // The other seat brings the Editor in front for itself, then presses its text by the ref it read.
    const shown = editor && showsFor(other, editor);
    const pressed = shown && other.as('press', shown);
    const texts = editor ? other.as('read', 'window', `w${editor.id}`, '--roles', 'textbox') : '';
    const [, text] = /^ +textbox \[text \d+\] (\d+\.\d+)$/m.exec(texts) ?? [];
    const acted = text && other.as('press', text);
    const inEditor = editor ? reader.as('read', 'window', `w${editor.id}`, '--roles', 'textbox') : '';
    check(
        'reading: the Editor read by one seat while another types in it names that seat as focused',
        acted === `over ${editor?.id}, key` &&
            new RegExp(`^window w${editor?.id} "Editor" editor .*\\[key ${other.seat}\\] mark \\d+$`, 'm').test(
                inEditor
            ) &&
            new RegExp(`^ +textbox \\[focused ${other.seat}, text \\d+\\] ${text}$`, 'm').test(inEditor),
        JSON.stringify({ shown, pressed, texts, acted, inEditor })
    );
}

module.exports = { run };
