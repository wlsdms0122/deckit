// The forge daemons, for the mods that require this one: it starts, stops and restarts them, holds the token each
// hands the process that starts it, and runs forge's operations on them. It has no view.
class Forge {
    static configuration = {
        forge: {
            type: 'string',
            title: 'Forge command',
            description: "Where the forge program is, as a full path. Empty: the forge on your login shell's PATH.",
            default: '',
        },
        forgeConfig: {
            type: 'string',
            title: 'Forge configuration',
            description:
                "The config.toml the default session is served with. Empty: forge's own, in the session's folder.",
            default: '',
        },
    };
    static form = {
        forge: { placeholder: 'forge' },
        forgeConfig: { placeholder: '~/.config/forge/default/config.toml' },
    };
    static icon = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4"/><path d="M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z"/><path d="M9 12v5"/><path d="M15 12v5"/><path d="M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1"/></svg>`;
    static keywords = ['forge', 'daemon', 'workflow', 'service', 'schedule'];

    async start(deckit) {
        const PLACES = ['forge', 'forgeConfig'];
        const forge = await deckit.mainProcess('main-process/forge.js');
        const places = () => Object.fromEntries(PLACES.map((key) => [key, deckit.configuration.get(key)]));
        await forge.use(places());
        deckit.configuration.on((key) => {
            if (PLACES.includes(key)) forge.use(places());
        });

        // Each takes a session last, `default` when it is not given. A dispatch is recorded as the calling mod's.
        deckit.exports({
            sessions: () => forge.sessions(),
            session: (session) => forge.session(session),
            start: (session) => forge.start(session),
            stop: (session) => forge.stop(session),
            restart: (session) => forge.restart(session),
            log: (lines, session) => forge.log(session, lines),
            call: (operation, args, session) => forge.call(session, operation, args, deckit.caller()),
            runSchedule: (id, session) => forge.runSchedule(session, id, deckit.caller()),
            run: (id) => forge.run(id),
        });
        forge.on('run', (run) => deckit.emit('run', run));
    }
}

module.exports = Forge;
