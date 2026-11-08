// The packages mod (mods/packages) over a stand-in for deckit: the version requirements package.toml writes, the
// versions each takes, the package file of a folder as its main process module reads it, the dependencies read against
// the mods installed, and deckit/packages planning and installing through deckit.mods, refused while one is unmet.
// Exits 1 with a line for each check that failed.
const fs = require('fs');
const os = require('os');
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'deckit', 'mods', 'packages');
const { requirementOf, takes } = require(path.join(MOD, 'src', 'requirement', 'requirement.js'));
const { dependenciesOf, unmetOf } = require(path.join(MOD, 'src', 'dependency', 'dependency.js'));
const { packages } = require(path.join(MOD, 'src', 'packages', 'packages.js'));
const packageFile = require(path.join(MOD, 'main-process', 'package', 'package.js'));

const json = (value) => JSON.stringify(value);

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${json(seen)}`);
    };
    const rejection = async (promise) => {
        try {
            await promise;
            return null;
        } catch (error) {
            return { message: error.message, kind: error.kind };
        }
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
    const read = dependenciesOf({ dependencies: { forge: '1.0', notes: '^1', calendar: '2' } }, found);
    check(
        'each dependency, with the version installed and whether it is taken',
        json(read) ===
            json([
                { id: 'forge', requirement: '1.0', installed: '1.4.0', satisfied: true },
                { id: 'notes', requirement: '^1', installed: '0.9.0', satisfied: false },
                { id: 'calendar', requirement: '2', satisfied: false },
            ]),
        read
    );
    check('no table, no dependencies', json(dependenciesOf({}, found)) === '[]');
    check(
        'a dependencies that is no table is refused',
        thrown(() => dependenciesOf({ dependencies: ['forge'] }, found))?.kind === 'PACKAGE'
    );
    check(
        'a requirement not written so is refused',
        json(thrown(() => dependenciesOf({ dependencies: { forge: '>1' } }, found))) ===
            json({ message: 'forge = ">1" is no version requirement', kind: 'REQUIREMENT' }),
        thrown(() => dependenciesOf({ dependencies: { forge: '>1' } }, found))
    );
    check(
        'a requirement of no text is refused',
        thrown(() => dependenciesOf({ dependencies: { forge: { version: '1' } } }, found))?.kind === 'REQUIREMENT'
    );
    const unmet = unmetOf(read);
    check(
        'the unmet ones named',
        unmet?.kind === 'UNMET_DEPENDENCY' &&
            unmet.message === 'unmet dependencies: notes ^1 is installed as 0.9.0; calendar 2 is not installed',
        unmet && { message: unmet.message, kind: unmet.kind }
    );
    check('one unmet', unmetOf(read.slice(2))?.message === 'unmet dependency: calendar 2 is not installed');
    check('none unmet, no refusal', unmetOf(read.slice(0, 1)) === null && unmetOf([]) === null);

    // The package file of a folder, as the main process module reads it.
    const folders = fs.mkdtempSync(path.join(os.tmpdir(), 'deckit-packages-test-'));
    const folderOf = (name, text) => {
        const folder = path.join(folders, name);
        fs.mkdirSync(folder);
        if (text !== null) fs.writeFileSync(path.join(folder, 'package.toml'), text);
        return folder;
    };
    const file = packageFile({ files: { refuse: (kind, message) => Object.assign(new Error(message), { kind }) } });
    const bot = await file.read(path.join(__dirname, '..', '..', 'deckit', 'mods', 'bot'));
    check("bot's package file names forge", json(bot) === json({ dependencies: { forge: '1.0' } }), bot);
    const none = await file.read(folderOf('none', null));
    check('a folder with no package file holds nothing', json(none) === '{}', none);
    const quoted = await file.read(
        folderOf('quoted', '# what it needs\n[dependencies]\n"com.example" = ">=1.2, <2" # a range\nforge = "1"\n')
    );
    check(
        'a package file read as TOML',
        json(quoted) === json({ dependencies: { 'com.example': '>=1.2, <2', forge: '1' } }),
        quoted
    );
    const broken = await rejection(file.read(folderOf('broken', '[dependencies]\nforge = 1.0\n')));
    check(
        'text that is no TOML is refused with its line',
        broken?.kind === 'PACKAGE' && /line 2/.test(broken.message),
        broken
    );

    // deckit/packages over a stand-in for deckit.mods, with the folders' package files as the module reads them.
    const files = {
        '/m/ready': { dependencies: { forge: '1.0' } },
        '/m/early': { dependencies: { notes: '^1', calendar: '2' } },
        '/m/plain': {},
    };
    const asked = [];
    const deckit = {
        mods: {
            plan: async (folder) => {
                asked.push(['plan', folder]);
                if (!files[folder])
                    throw Object.assign(new Error(`${folder} has no manifest.toml`), { kind: 'MANIFEST' });
                return { id: folder.split('/').pop(), name: 'Mod', permissions: [], from: folder, replaces: false };
            },
            install: async (folder) => {
                asked.push(['install', folder]);
                return { id: folder.split('/').pop(), version: '1.0.0' };
            },
            list: async () => ({ found, running: [], interfaces: [] }),
        },
    };
    const service = packages(deckit, { read: async (folder) => files[folder] ?? {} });
    const client = (permissions) =>
        service.exportsFor({ credential: { mod: 'settings', permissions }, mod: { name: 'Settings' } });
    const settings = client(['deckit.mods']);
    const planned = await settings.plan('/m/early');
    check(
        "a plan is deckit.mods' with the dependencies",
        planned.id === 'early' &&
            planned.from === '/m/early' &&
            json(planned.dependencies.map((each) => each.satisfied)) === '[false,false]',
        planned
    );
    check(
        'a folder deckit.mods refuses is refused as it is',
        (await rejection(settings.plan('/m/none')))?.kind === 'MANIFEST'
    );
    asked.length = 0;
    const refusedInstall = await rejection(settings.install('/m/early'));
    check(
        'an install while a dependency is unmet is refused, each one named, and nothing installs',
        refusedInstall?.kind === 'UNMET_DEPENDENCY' &&
            /notes \^1/.test(refusedInstall.message) &&
            /calendar 2/.test(refusedInstall.message) &&
            asked.length === 0,
        { refusedInstall, asked }
    );
    const installed = await settings.install('/m/ready');
    check(
        'an install whose dependencies are met goes through deckit.mods',
        installed.id === 'ready' && json(asked) === json([['install', '/m/ready']]),
        { installed, asked }
    );
    check('a folder that depends on nothing installs', (await settings.install('/m/plain')).id === 'plain');
    const stranger = client([]);
    for (const call of ['plan', 'install'])
        check(
            `a client that does not hold deckit.mods is refused ${call}`,
            json(await rejection(stranger[call]('/m/ready'))) ===
                json({ message: 'Settings does not hold deckit.mods', kind: 'NOT_PERMITTED' })
        );
    fs.rmSync(folders, { recursive: true, force: true });

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
