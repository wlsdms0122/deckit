// Starts an assembled Deckit.app for the test without taking the screen: macOS opens it in the background
// (`open -g`), and inactive.js, run before the app's own entry, keeps it from ever becoming the active app. It is
// stopped when the test's process exits, and a test still running after `limit` ms is ended as a failure, its app with
// it.
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync, spawn } = require('child_process');

const { electronApp } = require(path.join(__dirname, '..', 'electron.js'));
const INACTIVE = path.join(__dirname, 'inactive.js');
const ENTRY = 'test-main.js';

function launch({ app: folder, data, port, log, limit }) {
    // The app's own process only: the helpers end with it. It quits as asked, holding until its mods stop, and one
    // still there a few seconds later is killed, after the test has gone.
    const pattern = `--remote-debugging-port=${port} `;
    let pid = null;
    const stop = () => {
        pid ??= pidOf(pattern);
        if (!pid) return;
        try {
            process.kill(pid, 'SIGTERM');
        } catch {}
        spawn('sh', ['-c', `sleep 5; kill -9 ${pid} 2>/dev/null`], { detached: true, stdio: 'ignore' }).unref();
    };
    // One a test before left on this port.
    try {
        execSync(`pkill -9 -f -- '${pattern}'`);
    } catch {}
    const manifest = path.join(folder, 'package.json');
    const app = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    fs.writeFileSync(path.join(folder, ENTRY), `require(${JSON.stringify(INACTIVE)});\nrequire('./${app.main}');\n`);
    fs.writeFileSync(manifest, JSON.stringify({ ...app, main: ENTRY }, null, 4));
    execFileSync('open', [
        '-g',
        '-n',
        '-a',
        electronApp(),
        '--env',
        `DECKIT_DATA=${data}`,
        '--stdout',
        log,
        '--stderr',
        log,
        '--args',
        `--remote-debugging-port=${port}`,
        folder,
    ]);
    for (let tries = 0; tries < 50 && !pid; tries++) {
        pid = pidOf(pattern);
        if (!pid) execSync('sleep 0.1');
    }
    process.on('exit', stop);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(1));
    setTimeout(() => {
        console.error(`[test] still running after ${limit} ms: ended`);
        process.exit(1);
    }, limit).unref();
    return { stop };
}

function pidOf(pattern) {
    try {
        return Number(execSync(`pgrep -f -- '${pattern}'`).toString().trim().split('\n')[0]) || null;
    } catch {
        return null;
    }
}

module.exports = { launch };
