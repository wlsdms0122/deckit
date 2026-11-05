// The styles a page wears (deckit-shell/shell/style/main): what mods with deckit.styles declare and what their running
// runs give every page, and what they give a mod's page by its id, from the mod itself and from any other, in the load
// order. Exits 1 with a line for
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
    const mods = { ...Object.fromEntries(Object.keys(runs).map((id) => [id, mod(id)])), e: mod('e'), f: mod('f', []) };
    mods.c = mod('c', []);
    const contributes = {
        a: { styles: { '*': 'all.css' } },
        e: { styles: { a: 'a.css', b: 'missing.css' } },
        f: { styles: { a: 'a.css' } },
    };
    const files = { 'a/all.css': 'a-declared', 'e/a.css': 'e-a', 'f/a.css': 'f-a' };
    const handlers = {};
    const deckit = {
        channels: { bind: (declared) => ({ handle: (handler) => (handlers[declared.channel] = handler), send() {} }) },
        mods: {
            list: () => Object.values(mods),
            runOf: (id) => runs[id] ?? null,
            contributesOf: (id) => contributes[id] ?? {},
            readFile: async (id, file) => files[`${id}/${file}`] ?? null,
            modOf: (page) => page.mod,
            observe() {},
            onChange() {},
        },
        pages: { nameOf: () => 'panel', whenEnds() {} },
    };
    createStyle({ deckit }).start();
    await new Promise((resolve) => setImmediate(resolve));
    const current = Object.values(handlers)[0];

    const own = current({}, { mod: 'a' }).join();
    check(
        "a mod's page wears every page's styles, and by its id those of each mod with deckit.styles, its own too, " +
            'declared ones whether the mod runs or not',
        own === 'a-declared,a-all,a-own,b-a,d-all,d-a,e-a',
        own
    );
    const shell = current({}, { mod: null }).join();
    check("a page the shell made wears every page's styles alone", shell === 'a-declared,a-all,d-all', shell);
    const declared = current({}, { mod: 'b' }).join();
    check('a file a mod declares that is not there is left out', declared === 'a-declared,a-all,d-all', declared);

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
