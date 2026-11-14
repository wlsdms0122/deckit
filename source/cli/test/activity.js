// The Settings mod's Activity section (mods/settings/src/sections/activity): the mods it lists as running, how long
// each ran, and what is wrong with it. Exits 1 with a line for each check that failed.
const path = require('path');

async function main() {
    const ACTIVITY = require(
        path.join(
            __dirname,
            '..',
            '..',
            'deckit',
            'mods',
            'settings',
            'src',
            'sections',
            'activity',
            'activity-section.js'
        )
    );
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, mod: { name: id.toUpperCase() } }));
    const runs = [
        { id: 'e', state: 'terminating' },
        { id: 'a', state: 'running' },
        { id: 'b', state: 'notRunning' },
        { id: 'd', state: 'launching' },
        { id: 'f', state: 'running' },
    ];
    const running = ACTIVITY.runningOf(list, runs)
        .map(({ id, name }) => id + name)
        .join();
    check(
        'a mod launching, running or terminating is listed with its name, in the mods order',
        running === 'aA,dD,eE,fF',
        running
    );

    const elapsed = [20000, 5 * 60000, 125 * 60000, (50 * 60 + 3) * 60000].map(ACTIVITY.elapsedText);
    const told = ['less than a minute', '5 min', '2 h 5 min', '2 d 2 h'];
    check('how long a mod ran, in the largest unit', JSON.stringify(elapsed) === JSON.stringify(told), elapsed);

    const problems = ACTIVITY.problemsOf(
        { run: { problem: 'crashed', refusal: { stage: 'launch', kind: 'LIMIT', message: 'at the relaunch limit' } } },
        'refused'
    );
    check(
        "a run's problem, what it was refused with at launch and a refusal here are all told",
        problems.join('|') === 'crashed|at the relaunch limit|refused',
        problems
    );
    const none = ACTIVITY.problemsOf({ run: { problem: null, refusal: null } }, undefined);
    check('a run with nothing wrong tells nothing', none.length === 0, none);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} activity checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
