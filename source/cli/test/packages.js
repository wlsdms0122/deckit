// The packages mod (mods/packages/src): the version requirements package.toml writes, the versions each takes, and
// the dependencies of a package read against the mods installed, with the refusal while one is unmet. Exits 1 with a
// line for each check that failed.
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'deckit', 'mods', 'packages', 'src');
const { requirementOf, takes } = require(path.join(MOD, 'requirement', 'requirement.js'));
const { dependenciesOf, unmetOf, UNMET } = require(path.join(MOD, 'dependency', 'dependency.js'));

const json = (value) => JSON.stringify(value);

function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${json(seen)}`);
    };
    const thrown = (run) => {
        try {
            run();
            return null;
        } catch (error) {
            return { message: error.message, kind: error.kind };
        }
    };

    // Each requirement, the versions it takes and the first it does not past them.
    const ranges = [
        ['1.2.3', ['1.2.3', '1.9.0'], ['1.2.2', '2.0.0']],
        ['1.2', ['1.2.0', '1.99.99'], ['1.1.9', '2.0.0']],
        ['1', ['1.0.0', '1.9.9'], ['0.9.9', '2.0.0']],
        ['0.2.3', ['0.2.3', '0.2.9'], ['0.2.2', '0.3.0']],
        ['0.0.3', ['0.0.3'], ['0.0.2', '0.0.4']],
        ['0.0', ['0.0.0', '0.0.9'], ['0.1.0']],
        ['0', ['0.0.0', '0.9.9'], ['1.0.0']],
        ['^1.2', ['1.2.0', '1.9.0'], ['1.1.0', '2.0.0']],
        ['~1.2.3', ['1.2.3', '1.2.9'], ['1.2.2', '1.3.0']],
        ['~1.2', ['1.2.0', '1.2.9'], ['1.1.9', '1.3.0']],
        ['~1', ['1.0.0', '1.9.0'], ['0.9.9', '2.0.0']],
        ['=1.2.3', ['1.2.3'], ['1.2.2', '1.2.4']],
        ['=1.2', ['1.2.0', '1.2.9'], ['1.1.9', '1.3.0']],
        ['=1', ['1.0.0', '1.9.9'], ['0.9.9', '2.0.0']],
        ['>=1.2', ['1.2.0', '9.0.0'], ['1.1.9']],
        ['<1.2', ['0.0.0', '1.1.9'], ['1.2.0']],
        ['>=1.2, <1.5', ['1.2.0', '1.4.9'], ['1.1.9', '1.5.0']],
        ['>= 1.2,< 2', ['1.2.0', '1.9.9'], ['1.1.9', '2.0.0']],
        ['1.2, ~1.4', ['1.4.0', '1.4.9'], ['1.3.9', '1.5.0']],
    ];
    for (const [written, taken, left] of ranges) {
        const read = requirementOf(written);
        check(`${written} is a requirement`, read !== null && read.written === written, read);
        if (!read) continue;
        for (const version of taken) check(`${written} takes ${version}`, takes(read, version), read);
        for (const version of left) check(`${written} leaves ${version}`, !takes(read, version), read);
    }
    check('a range of none takes none', !takes(requirementOf('>=2, <1'), '1.5.0'));
    for (const written of ['', ' ', 'x', '1.2.3.4', 'v1', '1.x', '*', '>1', '<=1', '1.2-beta', '1,', '1 2', 1, null])
        check(`${json(written)} is no requirement`, requirementOf(written) === null, requirementOf(written));
    check('a part past a safe whole number is none', requirementOf('9007199254740993') === null);

    // Dependencies against the mods installed.
    const found = [
        { id: 'forge', version: '1.4.0' },
        { id: 'notes', version: '0.9.0' },
    ];
    const read = dependenciesOf({ forge: '1.0', notes: '^1', calendar: '2' }, found);
    check(
        'each dependency, with the version installed and whether it is taken',
        json(read) ===
            json([
                { id: 'forge', requirement: '1.0', installed: '1.4.0', satisfied: true },
                { id: 'notes', requirement: '^1', installed: '0.9.0', satisfied: false },
                { id: 'calendar', requirement: '2', installed: null, satisfied: false },
            ]),
        read
    );
    check('no table, no dependencies', json(dependenciesOf(undefined, found)) === '[]');
    check(
        'a requirement not written so is refused',
        json(thrown(() => dependenciesOf({ forge: '>1' }, found))) ===
            json({ message: 'forge = ">1" is no version requirement', kind: 'REQUIREMENT' }),
        thrown(() => dependenciesOf({ forge: '>1' }, found))
    );
    check(
        'a requirement of no text is refused',
        thrown(() => dependenciesOf({ forge: { version: '1' } }, found))?.kind === 'REQUIREMENT'
    );
    const unmet = unmetOf(read);
    check(
        'the unmet ones named',
        unmet?.kind === UNMET &&
            UNMET === 'UNMET_DEPENDENCY' &&
            unmet.message === 'unmet dependencies: notes ^1 is installed as 0.9.0; calendar 2 is not installed',
        unmet && { message: unmet.message, kind: unmet.kind }
    );
    check('one unmet', unmetOf(read.slice(2))?.message === 'unmet dependency: calendar 2 is not installed');
    check('none unmet, no refusal', unmetOf(read.slice(0, 1)) === null && unmetOf([]) === null);

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
