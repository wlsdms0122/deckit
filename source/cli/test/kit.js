// The kit's parts as a page's reader answers them in the app under test: the window probe draws one of each in its
// window, and what the reader tells of that page is held, line by line, to what each part is to whoever reads it.
const path = require('path');
const { pathToFileURL } = require('url');
const { sleep } = require('./devtools.js');
const { asked } = require('./read.js');

const MODEL = pathToFileURL(
    path.join(__dirname, '..', '..', 'deckit', 'deckit-shell', 'shell', 'desktop', 'model', 'reading.js')
).href;
const PROBE = 'window-probe';

// The parts in the order the probe draws them, under what the probe's window always shows, without their refs.
const PARTS = `button "Install"
list "Plain" (2 items, 2 in view)
  listitem "one"
  listitem "two"
listbox "Chosen" (2 items, 2 in view)
  option "one"
  option "two" [selected]
tablist "Tabs" (2 items, 2 in view)
  tab "one" [selected]
  tab "two"
tree "Tree" (2 items, 2 in view)
  treeitem "src" [expanded]
  treeitem "a.js"
textbox "Name" [value ""]
textbox "Find" [value ""]
button "Less"
spinbutton "Size" [value "12"]
button "More"
button "Add"
button "Close"
button "Match Case" [not pressed]
button "Save"
radiogroup "Mode"
  radio "Files" [checked]
  radio "Find" [unchecked]
switch "Wrap" [checked]
combobox "Font" [not expanded, haspopup=listbox, value "Default"]
group "Group"
  button "Group" [expanded]
navigation "Path"
  button "Home"
  button "Here" [current=page]
toolbar "Bar"`;

async function run({ check, main, open, page, show }) {
    const shown = await open(PROBE);
    await show(PROBE);
    const probe = await page(`deckit://${PROBE}.mod`);
    const { elementLine } = await import(MODEL);
    const read = await asked(main);
    const draw = (on) => probe.evaluate(`document.dispatchEvent(new CustomEvent('test-kit', { detail: ${on} }))`);
    await draw(true);
    await sleep(500);
    const outline = await read('outline', shown.id);
    await draw(false);
    const text = (outline.lines ?? [])
        .map((line) => '  '.repeat(line.depth) + elementLine(line).replace(/ \d+\.\d+$/, ''))
        .join('\n');
    check('kit: each part reads as its role, its name and its states', text === PARTS, text || JSON.stringify(outline));
}

module.exports = { run };
