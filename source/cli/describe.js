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
require(path.resolve(folder, 'registry.js'));
require(path.resolve(folder, 'cli.js'));
const api = DeckitModule.use(['deckit/service/plugin/package/manifest'], (MANIFEST) => MANIFEST.API);
const plugins = fs
    .readdirSync(path.join(folder, 'plugin'))
    .filter((name) => !name.startsWith('.'))
    .sort();
const described = {
    name: 'deckit',
    version,
    api,
    source,
    bundles,
    page: 'page.html',
    cli: 'deckit-cli/deckit-cli',
    plugins,
};
fs.writeFileSync(path.join(folder, 'deckit.json'), JSON.stringify(described, null, 2) + '\n');

function definedIn(file) {
    const defined = {};
    if (file === 'registry.js') return defined;
    const recorder = { define: (name, { provides = [] } = {}) => (defined[name] = { provides }), use: () => {} };
    new Function('DeckitModule', 'require', fs.readFileSync(path.join(folder, file), 'utf8'))(recorder, require);
    return defined;
}
