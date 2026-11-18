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

// A window's reading without what differs from run to run: its id, frame, holder and mark, each ref, each document's
// number and size, the seat a focus is of, how long a text is and a field's value.
const masked = (text) =>
    text
        .replace(/^window w\d+ ("[^"]*" \S+) at .* mark \d+$/m, 'window $1')
        .replace(/ (w\d+\.[a-z.]+|\d+\.\d+)$/gm, '')
        .replace(/^( *document) \d+ (.*) \d+x\d+$/gm, '$1 $2')
        .replace(/focused \w+/g, 'focused')
        .replace(/text \d+/g, 'text N')
        .replace(/value "[^"]*"/g, 'value "*"');
// The last line is the field the outside checks put into the window the local seat types in.
const EDITOR = `window "Editor" editor
  button "Close"
  button "Minimize"
  button "Zoom"
  titlebar
  document content
    complementary "Sidebar"
      group "Workspaces"
        button "Open"
        listbox "Workspaces" (1 items, 1 in view)
          option "deckit-test-files" [selected]
            button "Close workspace"
      radiogroup "Navigator"
        radio "Files" [checked]
        radio "Find" [unchecked]
      tree "Files" (4 items, 4 in view)
        treeitem "source" [expanded]
          button "Find in this folder"
        treeitem "other.js" [selected]
        treeitem "quick-open-target.js"
        treeitem "lines.txt"
    main
      toolbar
        tablist "Open files" (2 items, 2 in view)
          tab "lines.txt"
          tab "other.js" [selected]
      navigation "Path"
        button "deckit-test-files"
        button "source"
        button "other.js" [current=page]
      textbox "other.js" [focused, text N]
    separator "Sidebar" [expanded]
    textbox [value "*"]`;
// What is in view under the General section's rows is other sections', which is not held here.
const SETTINGS = `window "Settings" settings
  button "Close"
  button "Minimize"
  button "Zoom"
  titlebar
  document content
    complementary "Sidebar"
      navigation "Sections"
        listbox [focused] (7 items, 7 in view)
          option "Mods"
          option "Activity"
          option "General" [selected]
          option "Mod Settings"
          option "URL Schemes"
          option "Interfaces"
          option "Keyboard"
    main
      combobox "Font" [not expanded, haspopup=listbox, value "*"]
      spinbutton "Text size" [value "*"]`;

async function run({ check, reader, other, window, editor, settings, showsFor, inPage, page, field, folder, watch }) {
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
            seats[0].startsWith('seat local "Deckit" blue') &&
            seats.some((line) =>
                new RegExp(`^seat ${reader.seat} "Second" [a-z]+ at \\d+,\\d+ key w${window.id} \\(you\\)$`).test(line)
            ) &&
            seats.some((line) =>
                new RegExp(`^seat ${other.seat} "First" [a-z]+( at \\d+,\\d+)?( key w\\d+)?$`).test(line)
            ) &&
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
    const numbers = (lines) =>
        lines.filter((line) => /^ {2}document \d+ /.test(line)).map((line) => line.split(' ')[3]);
    const again = other.as('read', 'window', `w${window.id}`).split('\n');
    check(
        'reading: a document keeps its number across readings, whichever seat reads it',
        numbers(outline).length > 0 && numbers(again).join() === numbers(outline).join(),
        JSON.stringify({ outline: numbers(outline), again: numbers(again) })
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
    // Other windows the walk opened may still change: only what is of the typed field's document is read.
    const changed = reader.as('changes');
    const typedIn = String(ref).split('.')[0];
    const ofOwn = changed
        .split('\n')
        .filter((line, at) => !at || new RegExp(`( ${typedIn}\\.\\d+| document ${typedIn}( .*)?)$`).test(line));
    check(
        'reading: what changed after a typed line is one line',
        new RegExp(`^changes \\d+ to \\d+\\n~ textbox \\[focused ${reader.seat}, value "beta!"\\] ${ref}$`).test(
            ofOwn.join('\n')
        ),
        changed
    );
    const stale = reader.as('changes', '99999999');
    check('reading: a mark the desktop never had is refused', /never had the mark/.test(stale), stale);

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

    // A page that waits on its dialog is not read: its window reads the dialog's parts in its place, the mark goes
    // up as the dialog does and as it goes, and the seat answers it by their refs. Each dialog is started so the call
    // that asks it returns at once, as a page that waits runs nothing.
    const at = `w${window.id}.dialog`;
    const windowRead = () => reader.as('read', 'window', `w${window.id}`);
    const content = /^ {2}document \d+ content /m;
    const markOf = (text) => /^\S.* mark (\d+)$/m.exec(text)?.[1];
    const up = (part) =>
        until(() => {
            const read = windowRead();
            return read.includes(` ${at}.${part}`) && read;
        }, 4000);
    const asks = (call) => inPage(window.content, `(setTimeout(() => (window.deckitAnswer = ${call})), true)`);
    const answer = () => until(async () => (await inPage(window.content, 'window.deckitAnswer')) ?? null, 4000);
    // The seat's keys are at the child laid over the content: the content's confirm covers it, so Return answers OK.
    await asks(`confirm('Keep the child?')`);
    const keyedUp = await up('ok');
    const keyed = keyedUp && reader.as('key', 'Enter');
    const keyedAnswer = await answer();
    check(
        "reading: a content's confirm takes the Return of a seat whose keys are at a child it covers, and answers true",
        !!keyedUp && keyedAnswer === true,
        JSON.stringify({ keyedUp, keyed, keyedAnswer })
    );
    await inPage(window.content, 'delete window.deckitAnswer');
    const before = markOf(windowRead());
    await asks(`confirm('Keep the draft?')`);
    const confirmRead = await up('ok');
    const cameAt = markOf(confirmRead);
    const came = reader.as('changes', String(before));
    const confirmPressed = confirmRead && reader.as('press', `${at}.ok`);
    const confirmAnswer = await answer();
    const answered = windowRead();
    const went = reader.as('changes', String(cameAt));
    check(
        "reading: a page's confirm reads in its window in place of its page, who asks, the message and its buttons, " +
            'and OK answers true',
        !!confirmRead &&
            new RegExp(
                `^ {2}text "[^"]+" ${at}\\.from\\n {2}text "Keep the draft\\?" ${at}\\.message\\n` +
                    ` {2}button "Cancel" ${at}\\.cancel\\n {2}button "OK" ${at}\\.ok$`,
                'm'
            ).test(confirmRead) &&
            !content.test(confirmRead) &&
            confirmAnswer === true &&
            content.test(answered) &&
            !answered.includes(at),
        JSON.stringify({ confirmRead, confirmPressed, confirmAnswer, answered })
    );
    check(
        'reading: the mark goes up as a dialog goes up and as it goes, its parts told as they come and go',
        Number(cameAt) > Number(before) &&
            new RegExp(`^\\+ button "OK" ${at}\\.ok$`, 'm').test(came) &&
            new RegExp(`^- ${at}\\.ok$`, 'm').test(went),
        JSON.stringify({ before, cameAt, came, went })
    );
    await inPage(window.content, 'delete window.deckitAnswer');
    await asks(`prompt('Name it', 'draft')`);
    const promptRead = await up('field');
    // The seat presses the field and types: its keys go to the dialog up in the window that holds them.
    const fieldTyped =
        promptRead &&
        (reader.as('press', `${at}.field`),
        reader.as('type', ' notes'),
        await until(() => {
            const read = windowRead();
            return read.includes(`textbox [value "draft notes"] ${at}.field`) && read;
        }, 4000));
    if (fieldTyped) reader.as('press', `${at}.ok`);
    const promptAnswer = await answer();
    check(
        "reading: a prompt's field reads with its text, and OK answers it",
        !!promptRead && new RegExp(`^ {2}textbox \\[value "draft"\\] ${at}\\.field$`, 'm').test(promptRead),
        JSON.stringify({ promptRead })
    );
    check(
        "reading: what a seat types goes into a prompt's field, and OK answers the typed text",
        !!fieldTyped && promptAnswer === 'draft notes',
        JSON.stringify({ fieldTyped, promptAnswer })
    );
    await inPage(window.content, 'delete window.deckitAnswer');

    // The other seat brings the Editor in front for itself, then presses its text by the ref it read.
    const shown = editor && showsFor(other, editor);
    const pressed = shown && other.as('press', shown);
    const texts = editor ? other.as('read', 'window', `w${editor.id}`, '--roles', 'textbox') : '';
    const [, text] = /^ +textbox "[^"]+" \[text \d+\] (\d+\.\d+)$/m.exec(texts) ?? [];
    const byRef = text && other.as('press', text);
    const inEditor = editor ? reader.as('read', 'window', `w${editor.id}`, '--roles', 'textbox') : '';
    check(
        'reading: the Editor read by one seat while another types in it names that seat as focused',
        byRef === `over ${editor?.id}, key` &&
            new RegExp(`^window w${editor?.id} "Editor" editor .*\\[key ${other.seat}\\] mark \\d+$`, 'm').test(
                inEditor
            ) &&
            new RegExp(`^ +textbox "[^"]+" \\[focused ${other.seat}, text \\d+\\] ${text}$`, 'm').test(inEditor),
        JSON.stringify({ shown, pressed, texts, byRef, inEditor })
    );

    // The Editor and Settings as a seat reads them, each part by its role and its name. Settings is read once the
    // seat brought it in front by the Dock and pressed one of its sections, so what is in view is that section's rows.
    const inAll = editor ? masked(reader.as('read', 'window', `w${editor.id}`)) : '';
    console.log(`[reading] the Editor\n${inAll}`);
    check('reading: the Editor reads as its sidebar, its tree, its tabs and its text by name', inAll === EDITOR, inAll);
    const inFront = settings && reader.as('press', 'dock.settings');
    await sleep(800);
    const sections = settings ? reader.as('read', 'window', `w${settings.id}`, '--roles', 'option') : '';
    const [, first] = /^ +option "General".* (\d+\.\d+)$/m.exec(sections) ?? [];
    if (first) reader.as('press', first);
    await sleep(1500);
    const rows = settings
        ? masked(reader.as('read', 'window', `w${settings.id}`, '--roles', 'option,combobox,spinbutton'))
        : '';
    console.log(`[reading] Settings\n${rows}`);
    check(
        'reading: Settings reads as its sections, a navigation, and each row by its control named as the row is',
        rows === SETTINGS || rows.startsWith(`${SETTINGS}\n`),
        JSON.stringify({ inFront, first, rows })
    );
}

module.exports = { run };
