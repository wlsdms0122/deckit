// Command tokens (deckit-shell/deckit/command/main.js) over a stand-in for the core, the pages and the messages: a mod
// mints a token of its own command, the token crosses to another mod as a value, and that mod, with no permission to
// run commands, runs it, which runs the sender's command in the sender's page with the args it was minted with; a
// holder releases it and only its sender cancels it, and a token of a sender that is not running fails as its command
// would. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createCommand } = await import(url('deckit-shell', 'deckit', 'command', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // Two pages: a's, which sends a token, and b's, which holds it. What main tells a page is kept, and the test answers
    // as the page.
    const sender = { name: 'page a' };
    const holder = { name: 'page b' };
    const tells = [];
    let heard = null;
    const messages = {
        listen: (listeners) => (heard = listeners),
        tell: (page, message) => tells.push([page, message]),
    };
    const pages = { isGone: () => false, watch: () => {} };
    IPC.carry({ messages, pages }, { report: () => {} });

    let running = true;
    const mods = new Map([
        [sender, { id: 'a', permissions: [] }],
        [holder, { id: 'b', permissions: [] }],
    ]);
    const IDENTITY = {
        modOf: (page) => mods.get(page) || null,
        modFrom: (page, permission) => {
            const mod = mods.get(page);
            if (permission && !mod.permissions.some(({ id }) => id === permission))
                throw Object.assign(new Error(`${mod.id} does not have ${permission}`), { kind: 'REFUSED' });
            return mod;
        },
        pageOf: (id) => (id === 'a' && running ? sender : id === 'b' ? holder : null),
    };
    // The core keeps the tokens: one minted is the sender's command with its args until it ends.
    const kept = new Map();
    const asked = [];
    const CORE = {
        request: async (method, params) => {
            asked.push({ method, params });
            if (method === 'command/mint') {
                const token = `token-${kept.size + 1}`;
                kept.set(token, { id: token, sender: params.mod, command: params.command, args: params.args });
                return token;
            }
            if (method === 'command/check-token') {
                if (!kept.has(params.token)) throw Object.assign(new Error('no such token'), { kind: 'TOKEN' });
                return kept.get(params.token);
            }
            if (method === 'command/cancel') {
                if (kept.get(params.token)?.sender === params.mod) kept.delete(params.token);
                return true;
            }
            if (method === 'command/release') return kept.delete(params.token) || true;
            return true;
        },
    };
    const RUNNER = { observe: () => {}, runs: () => [] };
    const COMMAND = createCommand({ LOG: { warn: () => {} }, IDENTITY, RUNNER, CORE });
    COMMAND.start();

    const ask = (page, channel, payload) => heard.asked(page, { channel: `deckit-shell:${channel}`, payload });
    // The page answers main's question of it on `channel` with `value`.
    const answerAs = async (page, channel, value) => {
        await tick();
        const question = tells.find(([to, message]) => to === page && message.channel === `deckit-shell:${channel}`);
        heard.told(page, { channel: question[1].channel, id: question[1].id, value });
        return question[1].payload;
    };

    const minted = await ask(sender, 'command-mint', { command: 'open', args: { url: 'https://example.com' } });
    check(
        'a token is minted of the asking mod's own command, with its args',
        minted.value === 'token-1' &&
            asked[0].method === 'command/mint' &&
            asked[0].params.mod === 'a' &&
            asked[0].params.args.url === 'https://example.com',
        { minted, asked }
    );

    // The token crosses a connection as any value does: copied as JSON.
    const token = JSON.parse(JSON.stringify({ token: minted.value })).token;
    const refused = await ask(holder, 'command-run-of', { provider: 'a', command: 'open' });
    check(
        'the holder runs no command by name without deckit.command-registry',
        refused.error?.kind === 'REFUSED',
        refused
    );
    const result = ask(holder, 'command-run-token', { token });
    const told = await answerAs(sender, 'command-run', { opened: true });
    check(
        "running the token runs the sender's command in its page with the args it was minted with",
        told.command === 'open' && told.args.url === 'https://example.com',
        told
    );
    const ran = await result;
    check("the holder is answered the command's result", ran.value?.opened === true, ran);

    const cancelled = await ask(holder, 'command-cancel-token', { token });
    const still = asked.filter(({ method }) => method === 'command/cancel').pop();
    check('a cancel is asked as the asking mod, which the core holds to the sender', still.params.mod === 'b', still);
    check('a mod that did not mint a token does not end it by cancelling', kept.has(token), cancelled);

    running = false;
    const down = await ask(holder, 'command-run-token', { token });
    check(
        'a token of a sender that is not running fails as its command would',
        down.error?.kind === 'NOT_RUNNING',
        down
    );
    running = true;

    await ask(holder, 'command-release-token', { token });
    const ended = await ask(holder, 'command-run-token', { token });
    check('a token the holder released no longer runs', ended.error?.kind === 'TOKEN', ended);

    const other = (await ask(sender, 'command-mint', { command: 'open' })).value;
    await ask(sender, 'command-cancel-token', { token: other });
    check('the sender cancels its token', !kept.has(other), [...kept.keys()]);

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} command checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} command checks`);
}

main().catch((error) => {
    console.error('[command] ' + (error.stack || error.message));
    process.exit(1);
});
