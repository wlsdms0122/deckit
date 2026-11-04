// The styles a page wears (deckit-shell/shell/style/main): what running mods with deckit.styles give every page, and what
// they give a mod's page by its id, from the mod itself and from any other, in the load order. Exits 1 with a line for
// each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createStyle } = await import(url('deckit-shell', 'shell', 'style', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const mod = (id, permissions = [{ id: 'deckit.styles' }]) => ({ id, dependencies: {}, permissions });
    const runs = {
        a: { mod: mod('a'), state: 'running', contributions: { styles: { a: 'a-own', '*': 'a-all' } } },
        b: { mod: mod('b'), state: 'running', contributions: { styles: { a: 'b-a', c: 'b-c' } } },
        c: { mod: mod('c', []), state: 'running', contributions: { styles: { a: 'c-a' } } },
        d: { mod: mod('d'), state: 'running', contributions: { styles: { a: 'd-a', '*': 'd-all' } } },
    };
    const handlers = {};
    const deckit = {
        channels: { bind: (declared) => ({ handle: (handler) => (handlers[declared.channel] = handler), send() {} }) },
        mods: {
            list: () => Object.keys(runs).map((id) => ({ id })),
            runOf: (id) => runs[id],
            modOf: (page) => page.mod,
            observe() {},
            onChange() {},
        },
        pages: { nameOf: () => 'panel', whenEnds() {} },
    };
    createStyle({ deckit }).start();
    const current = Object.values(handlers)[0];

    const own = current({}, { mod: 'a' }).join();
    check(
        "a mod's page wears every page's styles, and by its id those of each mod with deckit.styles, its own too",
        own === 'a-all,a-own,b-a,d-all,d-a',
        own
    );
    const shell = current({}, { mod: null }).join();
    check("a page the shell made wears every page's styles alone", shell === 'a-all,d-all', shell);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} style checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
