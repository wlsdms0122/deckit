// The scope a lifecycle of a run cuts as it ends (deckit-shell/deck/runner/model/scope.js): each off it keeps runs
// once, whether it is called or cut, and one called is no longer kept. Exits 1 with a line for each check that failed.
// The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const SCOPE = pathToFileURL(
    path.join(__dirname, '..', '..', 'deckit', 'deckit-shell', 'deck', 'runner', 'model', 'scope.js')
).href;

async function main() {
    const { makeScope } = await import(SCOPE);
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const ran = [];
    const scope = makeScope();
    const first = scope.add(() => ran.push('first'));
    scope.add(() => ran.push('second'));
    const third = scope.add(() => ran.push('third'));
    third();
    third();
    check('an off called runs once', ran.join() === 'third', ran);
    scope.cut();
    check('cut runs the offs still kept, latest first', ran.join() === 'third,second,first', ran);
    first();
    scope.cut();
    check('an off cut does not run again, called or cut', ran.join() === 'third,second,first', ran);
    check('a cut scope says so', scope.isCut, scope.isCut);
    const late = scope.add(() => ran.push('late'));
    check('an off added once cut runs at once', ran.at(-1) === 'late', ran);
    late();
    check('what adding to a cut scope answers runs nothing', ran.filter((name) => name === 'late').length === 1, ran);

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} scope checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} scope checks`);
}

main().catch((error) => {
    console.error('[scope] ' + (error.stack || error.message));
    process.exit(1);
});
