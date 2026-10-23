// What a page deckit makes is told as it starts (deckit-shell/shell/page), over a stand-in for the environment's messages: a
// page the shell made by its name, and a mod's page its web sessions and whether the shell's UI is on deckit, so a
// host app that never attaches the shell runs its mods with deck's and deckit's alone. Exits 1 with a line for each
// check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createSetup } = await import(url('deckit-shell', 'shell', 'page', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    let heard = null;
    const messages = { listen: (listeners) => (heard = listeners), tell: () => {} };
    IPC.carry({ messages, pages: { isGone: () => false, watch: () => {} } }, { report: () => {} });
    const frame = { name: 'panel' };
    const modPage = { mod: 'a' };
    const IDENTITY = {
        pageNameOf: (page) => page.name || null,
        modOf: (page) => (page.mod ? { id: page.mod } : null),
    };
    const SETUP = createSetup({ IDENTITY, web: { sessionsOf: (mod) => `sessions of ${mod}` } });
    SETUP.start();
    const setup = (page) => heard.askedSync(page, { channel: 'deckit-shell:page-setup', payload: {} });

    const named = await setup(frame);
    check('a page the shell made is told its name', named.value?.page === 'panel', named);
    const before = await setup(modPage);
    check("a mod's page is told its web sessions", before.value?.sessions === 'sessions of a', before);
    check("a mod's page wears no shell UI before the shell is attached", before.value?.attached === false, before);
    SETUP.attach();
    const after = await setup(modPage);
    check("a mod's page wears the shell's UI once it is attached", after.value?.attached === true, after);
    check('a page the shell made is told only its name', Object.keys(named.value || {}).join() === 'page', named);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} page checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
