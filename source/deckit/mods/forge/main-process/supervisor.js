// `command` runs forge, and `config` is the config.toml the `default` session is served with, forge's own in the
// session's folder when null. `track(child)` is handed each command it runs, and once `live()` is false it starts no
// daemon. `commands` runs them, and `runs` follows each run dispatched to its end. A dispatch is told `by` whom: the
// mod that asked, which forge records as who dispatched the run.
module.exports = ({ command, config, track, live, commands, runs }) => {
    const { app } = require('electron');
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    const DEFAULT = 'default';
    const SESSION_NAME = /^[a-z0-9][a-z0-9_-]*$/i;
    const SESSIONS_DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config'), 'forge');
    const sessionHome = (session) => path.join(SESSIONS_DIR, session);
    const sessionName = (session) => {
        const name = String(session || DEFAULT);
        if (!SESSION_NAME.test(name)) throw new Error('bad session name: ' + name);
        return name;
    };
    const logFile = (session) => path.join(sessionHome(session), 'log', 'proc.log');
    // What forge runs in: the session it is for is given as `--session`, never taken from this process.
    const environment = async () => {
        const env = await commands.environment();
        delete env.FORGE_SESSION;
        delete env.FORGE_SOCKET;
        return env;
    };

    // A daemon's token is kept outside the mod's data folder: every app that runs this mod controls the same daemons
    // with it.
    const tokenDir = (session) =>
        path.join(app.getPath('home'), 'Library', 'Caches', 'im.toss.jineun.bot.forge', session);
    const tokenFile = (session) => path.join(tokenDir(session), 'bootstrap.token');

    const sharedTokenFile = (session) => (session === DEFAULT ? null : path.join(sessionHome(session), 'admin.token'));

    const writeSecret = (file, token, ownDir) => {
        const dir = path.dirname(file);
        fs.mkdirSync(dir, { recursive: true });

        if (ownDir) fs.chmodSync(dir, 0o700);
        fs.writeFileSync(file, token + '\n');
        fs.chmodSync(file, 0o600);
    };

    const writeToken = (session, token) => {
        try {
            writeSecret(tokenFile(session), token, true);
        } catch (error) {
            throw new Error(
                'forge is up, but its token could not be kept, so it cannot be controlled from here: ' + error.message
            );
        }
        rejected.delete(session);
        if (!sharedTokenFile(session)) return null;
        try {
            writeSecret(sharedTokenFile(session), token, false);
            return null;
        } catch (error) {
            return "the session's admin.token could not be written: " + error.message;
        }
    };

    const rejected = new Map();
    const readToken = (session) => {
        for (const file of [tokenFile(session), sharedTokenFile(session)]) {
            if (!file) continue;
            try {
                const token = fs.readFileSync(file, 'utf8').trim();
                if (token && token !== rejected.get(session)) return token;
            } catch {}
        }
        return null;
    };

    const dropToken = (session) => {
        try {
            fs.unlinkSync(tokenFile(session));
        } catch {}
    };

    const serviceName = (args) => {
        const name = String((args && args.name) || '');
        if (!/^[a-z][a-z0-9_-]*$/i.test(name)) throw new Error('bad service name: ' + name);
        return name;
    };

    const workflowArg = (args, key) => {
        const value = String(args[key] || '');
        if (!value || value.startsWith('-')) throw new Error(`bad workflow ${key}`);
        return value;
    };
    const dispatchArgs = (name, inputs, parameters, origin) => [
        'workflow',
        'dispatch',
        name,
        '--stream',
        '--inputs',
        JSON.stringify(inputs),
        '--parameters',
        JSON.stringify(parameters),
        '--origin',
        JSON.stringify(origin),
    ];

    const FORGE_OPS = new Map(
        Object.entries({
            status: { argv: () => ['status', '--json'], token: false },
            'service.status': { argv: () => ['service', 'status', '--json'], token: true },
            'service.list': { argv: () => ['service', 'list', '--json'], token: true },
            'service.run': { argv: (args) => ['service', 'run', serviceName(args), '--json'], token: true },
            'service.shutdown': { argv: (args) => ['service', 'shutdown', serviceName(args), '--json'], token: true },
            'service.restart': { argv: (args) => ['service', 'restart', serviceName(args), '--json'], token: true },
            'service.reload': { argv: () => ['service', 'reload', '--json'], token: true },
            'service.send': {
                argv: (args) => [
                    'service',
                    'send',
                    serviceName(args),
                    '--payload',
                    JSON.stringify(args.payload ?? {}),
                    '--json',
                ],
                token: true,
            },
            'workflow.list': { argv: () => ['workflow', 'list', '--json'], token: true },
            'workflow.describe': {
                argv: (args) => ['workflow', 'describe', workflowArg(args, 'name'), '--json'],
                token: true,
            },
            'workflow.active': { argv: () => ['workflow', 'active', '--json'], token: true },
            'workflow.cancel': {
                argv: (args) => ['workflow', 'cancel', workflowArg(args, 'id'), '--json'],
                token: true,
            },
            'workflow.dispatch': {
                argv: (args, by) => {
                    const name = workflowArg(args, 'name');
                    const run = require('crypto').randomUUID();
                    return dispatchArgs(
                        name,
                        args.inputs || {},
                        { session_id: `manual:${name}#${run}`, source: by },
                        { kind: 'manual', id: by }
                    );
                },
                token: true,
                follows: true,
            },
            'schedule.list': { argv: () => ['schedule', 'list', '--json'], token: true },
            'schedule.create': {
                argv: (args) => {
                    const argv = [
                        'schedule',
                        'create',
                        '--json',
                        '--workflow',
                        workflowArg(args, 'workflow'),
                        '--inputs',
                        JSON.stringify(args.inputs || {}),
                    ];
                    for (const key of ['every', 'at', 'once', 'after', 'timezone', 'days']) {
                        if (args.trigger?.[key] != null) argv.push(`--${key}=${args.trigger[key]}`);
                    }
                    if (args.concurrency) argv.push(`--concurrency=${args.concurrency}`);
                    return argv;
                },
                token: true,
            },
            ...Object.fromEntries(
                ['enable', 'disable', 'delete'].map((operation) => [
                    `schedule.${operation}`,
                    {
                        argv: (args) => ['schedule', operation, workflowArg(args, 'id'), '--json'],
                        token: true,
                    },
                ])
            ),
        })
    );

    // A token the daemon refused (forge's exit status 6) is not sent again.
    const refusedOn = (session, sent) => (error) => {
        if (error.code === 6) {
            dropToken(session);
            if (sent) rejected.set(session, sent);
        }
        throw error;
    };

    const runForge = async (session, argv, withToken, timeout = 15000) => {
        const env = await environment();
        const sent = withToken ? readToken(session) : null;
        if (withToken) env.FORGE_ACCESS_TOKEN = sent;
        return commands
            .run({ program: 'forge', command, argv: [...argv, '--session', session], env, timeout, track })
            .catch(refusedOn(session, sent));
    };

    // A dispatch with `--stream`: answers once forge has taken the run, which `runs` follows from there.
    const dispatchFollowed = async (session, argv) => {
        const env = await environment();
        const sent = readToken(session);
        env.FORGE_ACCESS_TOKEN = sent;
        const child = spawn(command, [...argv, '--session', session], { env, stdio: ['ignore', 'pipe', 'pipe'] });
        track(child);
        return runs
            .follow(session, child)
            .catch((error) => refusedOn(session, sent)(error.syscall ? commands.notRun('forge', error) : error));
    };

    const methods = {};

    methods.call = async (session, operation, args, by) => {
        const name = sessionName(session);
        const spec = FORGE_OPS.get(operation);
        if (!spec) throw new Error('unknown forge op: ' + operation);
        if (spec.token && !readToken(name)) throw new Error('no token: this daemon was not started from here');
        const argv = spec.argv(args || {}, by);
        if (spec.follows) return dispatchFollowed(name, argv);
        const out = await runForge(name, argv, spec.token);
        try {
            return JSON.parse(out);
        } catch {
            return { raw: out };
        }
    };
    methods.runSchedule = async (session, scheduleId, by) => {
        const name = sessionName(session);
        workflowArg({ id: scheduleId }, 'id');
        const { schedules } = await methods.call(name, 'schedule.list');
        const schedule = schedules.find((item) => item.id === scheduleId);
        if (!schedule) throw new Error('schedule no longer exists: ' + scheduleId);
        if (!schedule.workflow || schedule.workflow === '<inline>')
            throw new Error('run now requires a registered workflow');
        const argv = dispatchArgs(
            schedule.workflow,
            schedule.inputs || {},
            {
                session_id: `manual:${scheduleId}#${require('crypto').randomUUID()}`,
                source: by,
                schedule_id: scheduleId,
            },
            { kind: 'schedule', id: scheduleId }
        );
        return dispatchFollowed(name, argv);
    };

    const controlsFor = (up) => ({ start: !up, restart: up, stop: up });

    const describe = async (name) => {
        // A forge that answers nothing has no daemon up; one that could not be run says nothing about it.
        const status = await runForge(name, ['status', '--json'], false)
            .then(JSON.parse)
            .catch((error) => {
                if (error.notRun) throw error;
                return null;
            });
        const daemon = status?.daemon?.pid ? status.daemon : null;
        const authority = readToken(name) !== null;
        return { name, up: !!daemon, daemon, authority, controls: controlsFor(!!daemon) };
    };

    methods.sessions = async () => {
        let names = [];
        try {
            names = fs
                .readdirSync(SESSIONS_DIR, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && SESSION_NAME.test(entry.name))
                .map((entry) => entry.name);
        } catch {}
        names = [DEFAULT, ...names.filter((name) => name !== DEFAULT).sort()];
        return { main: DEFAULT, sessions: await Promise.all(names.map(describe)) };
    };

    methods.session = (session) => describe(sessionName(session));

    const start = async (session) => {
        if ((await describe(session)).up) throw new Error('forge is already running');
        // Served from the folder of its configuration: the one set for `default`, forge's own for the others.
        const given = session === DEFAULT && config;
        const found = given && fs.statSync(given, { throwIfNoEntry: false });
        if (given && !found) throw new Error("forge's configuration is not there: " + given);
        if (given && !found.isFile())
            throw new Error("forge's configuration is a folder; give its config.toml: " + given);
        const log = logFile(session);
        fs.mkdirSync(path.dirname(log), { recursive: true });
        const logFd = fs.openSync(log, 'a');
        try {
            const env = { ...(await environment()), FORGE_BOOTSTRAP_FD: '3' };
            if (!live()) throw new Error("the bot's settings changed before forge started");
            const argv = ['serve', '--session', session, ...(given ? ['--config', given] : [])];
            const child = spawn(command, argv, {
                cwd: given ? path.dirname(given) : sessionHome(session),
                env,
                stdio: ['ignore', logFd, logFd, 'pipe'],
                detached: true,
            });
            let failure = null;
            const bootstrap = await new Promise((resolve) => {
                let received = '';
                const done = (token) => {
                    clearTimeout(timer);
                    try {
                        child.stdio[3].destroy();
                    } catch {}
                    resolve(token);
                };
                const timer = setTimeout(() => done(null), 10000);
                child.stdio[3].on('data', (chunk) => {
                    received += chunk.toString('utf8');
                    const newline = received.indexOf('\n');
                    if (newline >= 0) done(received.slice(0, newline).trim() || null);
                });
                child.stdio[3].on('end', () => done(received.trim() || null));
                child.stdio[3].on('error', () => done(null));
                child.once('error', (error) => {
                    failure = error;
                    done(null);
                });
            });
            if (failure) throw commands.notRun('forge', failure);
            if (!bootstrap) {
                try {
                    child.kill('SIGKILL');
                } catch {}
                throw new Error('forge did not come up (no bootstrap token): the daemon log says why');
            }
            child.unref();
            return { note: writeToken(session, bootstrap) };
        } finally {
            fs.closeSync(logFd);
        }
    };

    const STOP_WAIT_MS = 15000;
    const stop = async (session) => {
        const { daemon } = await describe(session);
        if (!daemon) return false;
        process.kill(daemon.pid, 'SIGTERM');
        dropToken(session);
        const until = Date.now() + STOP_WAIT_MS;
        while (Date.now() < until) {
            try {
                process.kill(daemon.pid, 0);
            } catch {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        throw new Error(`forge did not stop within ${STOP_WAIT_MS / 1000}s`);
    };

    const turns = new Map();
    const underWay = new Map();
    const inTurn = (session, operation, job) => {
        const key = session + '|' + operation;
        if (underWay.has(key)) return underWay.get(key);
        const step = (turns.get(session) || Promise.resolve()).catch(() => {}).then(job);
        turns.set(session, step);
        underWay.set(key, step);
        const done = () => {
            underWay.delete(key);
            if (turns.get(session) === step) turns.delete(session);
        };
        step.then(done, done);
        return step;
    };
    methods.start = (session) => {
        const name = sessionName(session);
        return inTurn(name, 'start', () => start(name));
    };
    methods.stop = (session) => {
        const name = sessionName(session);
        return inTurn(name, 'stop', async () => {
            const { controls } = await describe(name);
            if (!controls.stop) throw new Error('forge is not running');
            return stop(name);
        });
    };

    methods.restart = (session) => {
        const name = sessionName(session);
        return inTurn(name, 'restart', async () => {
            await stop(name);
            return start(name);
        });
    };

    methods.log = async (session, lines) => {
        const log = logFile(sessionName(session));
        try {
            const stat = fs.statSync(log);
            const size = Math.min(stat.size, 64 * 1024);
            const fd = fs.openSync(log, 'r');
            try {
                const buffer = Buffer.alloc(size);
                fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - size));

                const text = buffer.toString('utf8');
                const whole = stat.size > size ? text.slice(text.indexOf('\n') + 1) : text;
                return whole
                    .split('\n')
                    .filter(Boolean)
                    .slice(-(lines || 20));
            } finally {
                fs.closeSync(fd);
            }
        } catch {
            return [];
        }
    };

    return { methods, run: runForge, hasToken: (session) => readToken(sessionName(session)) !== null, DEFAULT };
};
