// The keys authorized for a principal, as a host registers them: asked of deckit's core, the last build's, which is
// started for the one request against deckit's folder and ends once it answered. The core reads the keys each time it verifies a party, so
// a key registered or removed while the app runs is what the next party is held to.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const SOURCE = path.join(ROOT, 'source', 'deckit');
const APP = require(path.join(ROOT, 'source', 'cli', 'app.js'));
const SCHEME = 'ed25519';

// The archive the last build made, as much of it as asks its core, unpacked into `folder`: the core's file and the
// version of the mod contract it speaks.
function built(folder) {
    const archive = APP.builtArchive();
    execFileSync('tar', ['-xzf', archive, '-C', folder, './deckit.json']);
    const { core, api } = JSON.parse(fs.readFileSync(path.join(folder, 'deckit.json'), 'utf8'));
    execFileSync('tar', ['-xzf', archive, '-C', folder, `./${core}`]);
    return { core: path.join(folder, core), api };
}

// Deckit.app's folder of deckit, as the app itself works it out: under the data folder it is run with, or the
// person's own.
function appHome() {
    const { config, folders } = require(path.join(SOURCE, 'deckit-app', 'config', 'config.js'));
    return folders.home ?? path.join(os.homedir(), '.config', config.id);
}

// What the core answers `method` with, for deckit's folder `home`; rejects with what it refused it with, its `kind`
// and `stage` on it, or with why it answered nothing.
function ask(home, method, params) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'deckit-key-'));
    const answered = new Promise((resolve, reject) => {
        const { core, api } = built(folder);
        const child = spawn(core, [], { stdio: ['pipe', 'pipe', 'ignore'] });
        let rest = '';
        const send = (id, name, given) =>
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: name, params: given }) + '\n');
        const receive = ({ id, result = null, error = null }) => {
            if (error) reject(Object.assign(new Error(error.message), { code: error.code, ...error.data }));
            else if (id === 1) return send(2, method, params);
            else resolve(result);
            child.stdin.end();
        };
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            const lines = (rest + chunk).split('\n');
            rest = lines.pop();
            for (const line of lines) if (line) receive(JSON.parse(line));
        });
        child.stdin.on('error', () => {});
        child.on('error', reject);
        child.on('close', () => reject(new Error('the core ended before it answered')));
        send(1, 'initialize', { home, api, ship: [], sources: [], permissions: [], fields: [] });
    });
    return answered.finally(() => fs.rmSync(folder, { recursive: true, force: true }));
}

// `key`, the base64 of an Ed25519 public key's 32 bytes (RFC 8032), may authenticate as `principal` from now on, under
// `name`.
function add({ home, principal, key, name }) {
    return ask(home, 'key/add', { principal, scheme: SCHEME, key, name });
}

// `key` authenticates as `principal` no more.
function remove({ home, principal, key }) {
    return ask(home, 'key/remove', { principal, scheme: SCHEME, key });
}

// The keys that may authenticate as `principal`, each `{ scheme, key, name }`, in the order they were registered.
function list({ home, principal }) {
    return ask(home, 'key/list', { principal });
}

module.exports = { appHome, add, remove, list };
