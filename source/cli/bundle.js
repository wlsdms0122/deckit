// Deckit's bundles into a built library folder, and deckit.json beside them: what a host app reads to load it.
// usage: node bundle.js <library folder> <version> <source hash> <swift>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const LIBRARY = require('./library.js');

const [given, version, source, swift] = process.argv.slice(2);
const folder = path.resolve(given);

function esbuild(entry, outfile, options) {
    const { format, platform, target, global } = options;
    execFileSync(
        'npx',
        [
            '--yes',
            LIBRARY.ESBUILD,
            path.join(LIBRARY.DECKIT, entry),
            '--bundle',
            `--format=${format}`,
            `--platform=${platform}`,
            `--target=${target}`,
            '--external:electron',
            ...(global ? [`--global-name=${global}`] : []),
            `--define:DECKIT_VERSION=${JSON.stringify(version)}`,
            `--define:DECKIT_SOURCE=${JSON.stringify(source)}`,
            '--legal-comments=eof',
            '--log-level=warning',
            '--log-override:import-is-undefined=error',
            `--outfile=${outfile}`,
        ],
        { stdio: ['ignore', 'inherit', 'inherit'] }
    );
}

const bundles = {};
for (const [name, options] of Object.entries(LIBRARY.BUNDLES)) {
    esbuild(options.entry, path.join(folder, name + '.js'), options);
    bundles[name] = { file: name + '.js', ...(options.global ? { global: options.global } : {}) };
}

// The contract it speaks and the scheme its pages load from, read from deckit-electron's entry for them. The scheme is
// here as data for a host app that registers schemes before it loads a bundle.
const facts = path.join(folder, '.facts.cjs');
esbuild('deckit-electron/contract/index.js', facts, { format: 'cjs', platform: 'node', target: 'node22' });
const { API: api, SCHEME: scheme } = require(facts);
fs.rmSync(facts);

const mods = fs
    .readdirSync(path.join(folder, 'mods'))
    .filter((name) => !name.startsWith('.'))
    .sort();
// The core's executable, which the build put at the root.
const core = 'deckit';
if (!fs.existsSync(path.join(folder, core))) throw new Error('the library has no core');
const described = { name: 'deckit', version, api, source, swift, scheme, bundles, core, mods };
fs.writeFileSync(path.join(folder, 'deckit.json'), JSON.stringify(described, null, 2) + '\n');
