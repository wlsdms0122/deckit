// deckit.json for a built library folder: what an app reads to load it. Each bundle is run against a registry that
// records what it defines and makes nothing.
// usage: node describe.js <library folder> <version> <source hash>
const fs = require('fs');
const path = require('path');
const LIBRARY = require('./library.js');

const [folder, version, source] = process.argv.slice(2);
const bundles = {};
for (const name of Object.keys(LIBRARY.bundles()))
    bundles[name] = { file: name + '.js', defines: definedIn(name + '.js') };
// The contract it speaks and the scheme its pages load from, from their modules and what those name, run on the built
// registry. The scheme is here as data for a host app that registers schemes before it loads a bundle.
const MODULES = ['deckit/service/mod/manifest', 'deckit/service/deck/model/origin'];
require(path.resolve(folder, 'registry.js'));
for (const file of LIBRARY.filesFrom(MODULES)) require(path.join(LIBRARY.DECKIT, file));
const [api, scheme] = DeckitModule.use(MODULES, (MANIFEST, ORIGIN) => [MANIFEST.API, ORIGIN.SCHEME]);
const mods = fs
    .readdirSync(path.join(folder, 'mod'))
    .filter((name) => !name.startsWith('.'))
    .sort();
const described = {
    name: 'deckit',
    version,
    api,
    source,
    scheme,
    bundles,
    mods,
};
fs.writeFileSync(path.join(folder, 'deckit.json'), JSON.stringify(described, null, 2) + '\n');

function definedIn(file) {
    const defined = {};
    if (file === 'registry.js') return defined;
    const recorder = { define: (name, { provides = [] } = {}) => (defined[name] = { provides }), use: () => {} };
    new Function('DeckitModule', 'require', fs.readFileSync(path.join(folder, file), 'utf8'))(recorder, require);
    return defined;
}
