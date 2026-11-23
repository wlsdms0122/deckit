// Whether a press of a page's is a drag of its window (deckit-electron/page/model/drag): within a title bar over the
// document, a press on what the content does not take, whatever it marks, and none on what it takes, an element that
// takes or is marked `no-drag`, or on what lies in one; the bar's height its end; with no bar, or below it, a press
// where the pressed element is marked `drag` and nowhere else. Exits 1 with a line for each check that failed. The
// packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const DRAG = pathToFileURL(
    path.join(__dirname, '..', '..', 'deckit', 'deckit-electron', 'page', 'model', 'drag.js')
).href;

async function main() {
    const { drags } = await import(DRAG);
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const plain = { takes: false, region: '' };
    const button = { takes: true, region: '' };
    const marked = (region) => ({ takes: false, region });
    const cases = [
        ['a press in the bar on content that marks nothing drags', { bar: 48, y: 10, path: [plain, plain] }, true],
        ['a press in the bar on what the content takes does not', { bar: 48, y: 10, path: [button, plain] }, false],
        ['a press in the bar on what lies in what it takes does not', { bar: 48, y: 10, path: [plain, button] }, false],
        ['a press in the bar on what is marked no-drag does not', { bar: 48, y: 10, path: [marked('no-drag')] }, false],
        [
            'a press in the bar on a drag mark in what is marked no-drag does not',
            { bar: 48, y: 10, path: [marked('drag'), marked('no-drag'), plain] },
            false,
        ],
        ['a press in the bar on a drag mark drags', { bar: 48, y: 10, path: [marked('drag')] }, true],
        ["a press at the bar's height is below it", { bar: 48, y: 48, path: [plain] }, false],
        ['a press below the bar on a drag mark drags', { bar: 48, y: 60, path: [marked('drag'), plain] }, true],
        ['a press with no bar on content that marks nothing does not drag', { bar: null, y: 10, path: [plain] }, false],
        ['a press with no bar on a drag mark drags', { bar: null, y: 10, path: [marked('drag')] }, true],
        ['a press with no bar on a no-drag mark does not drag', { bar: null, y: 10, path: [marked('no-drag')] }, false],
        ['a press on no element does not drag', { bar: null, y: 10, path: [] }, false],
    ];
    for (const [name, press, expected] of cases) check(name, drags(press) === expected, press);
    for (const line of failed) console.log(line);
    console.log(`${count - failed.length} of ${count} drag checks passed`);
    process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
    console.log(`FAIL ${error.stack}`);
    process.exit(1);
});
