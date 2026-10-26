const { openAddress } = require('./address/open-address.js');
const { switcher } = require('./switcher/switcher.js');

// What a person asks of deck itself, as commands and as the switcher's actions: an address to open, a mod or the app
// to restart, deckit's folders, and what is running. It has no view.
module.exports = {
    keywords: ['deckit', 'deck'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>`,

    start(deck) {
        const { util } = deck;
        const APP_NAME = deck.about().name;
        const address = openAddress({ open: (url) => deck.open(url) });
        const STATES = { launching: 'Starting', running: 'Running', notRunning: 'Not running' };

        deck.commands({
            'open-address': {
                description: "Opens an address with its scheme, by its scheme's handlers in your order.",
                params: {
                    type: 'object',
                    properties: {
                        address: {
                            type: 'string',
                            title: 'Address',
                            description: 'With its scheme: https://…, file:///…',
                        },
                    },
                    required: ['address'],
                },
                run: ({ address: given }) => address.go(given),
                complete: (_param, partial) => address.candidatesFor(partial),
            },
            'restart-mod': {
                description: 'Restarts a mod, or launches one not running with the mods that require it.',
                params: {
                    type: 'object',
                    properties: { mod: { type: 'string', title: 'Mod' } },
                    required: ['mod'],
                },
                run: async ({ mod }) => {
                    await restartMod(mod);
                },
                complete: (_param, partial) => modsFor(partial),
            },
            'restart-app': {
                description: `Quits ${APP_NAME} and opens it again.`,
                run: async () => {
                    await deck.mods.restart();
                },
            },
            'show-mods-folder': {
                description: 'Shows the folder of the installed mods in Finder.',
                run: () => reveal('mods'),
            },
            'show-data-folder': {
                description: 'Shows the folder where mods keep their data in Finder.',
                run: () => reveal('data'),
            },
            'show-log': {
                description: `Shows the log of ${APP_NAME} in Finder.`,
                run: () => reveal('log'),
            },
            'copy-version': {
                description: 'Copies a version of what is running, for a report.',
                params: {
                    type: 'object',
                    properties: { version: { type: 'string', title: 'Version', enum: versions() } },
                    required: ['version'],
                },
                run: copyVersion,
            },
        });

        deck.extends.switcher({
            actions: switcher({
                util,
                appName: APP_NAME,
                address,
                modsFor,
                versions,
                does: {
                    'open-address': ({ address: given }) => address.go(given),
                    'restart-mod': ({ mod }) => restartMod(mod),
                    'restart-app': () => deck.mods.restart(),
                    'show-mods-folder': () => reveal('mods'),
                    'show-data-folder': () => reveal('data'),
                    'show-log': () => reveal('log'),
                    'copy-version': copyVersion,
                },
            }),
        });

        // One of deckit's places in `deck.about()`, shown in Finder.
        async function reveal(place) {
            await deck.reveal(deck.about()[place]);
        }

        async function copyVersion({ version }) {
            await deck.clipboard.writeText(version);
        }

        // One not running is launched, and the mods that require it with it. One that does not restart says why: one
        // that did not load, or one stopping. A refusal is told in a notice.
        function restartMod(id) {
            const mod = deck.mods.list().found.find((each) => each.id === id);
            if (!mod) throw new Error(`There is no mod ${id}`);
            if (!mod.run) throw new Error(`${mod.name} did not load: ${mod.problem || 'it cannot start'}`);
            if (mod.run.state === 'terminating') throw new Error(`${mod.name} is stopping`);
            return deck.mods.relaunch(mod.id);
        }

        // Every mod found, each with its state, ranked for `partial` by its name and id.
        function modsFor(partial) {
            const candidates = deck.mods.list().found.map((mod) => ({
                value: mod.id,
                title: mod.name,
                hint: !mod.run
                    ? mod.problem || 'Did not load'
                    : mod.run.state === 'terminating'
                      ? 'Stopping'
                      : STATES[mod.run.state],
            }));
            if (!partial.trim()) return candidates;
            return candidates
                .map((candidate) => ({
                    candidate,
                    found: util.matchFields(
                        [
                            { text: candidate.title, name: true },
                            { text: candidate.value, weight: 0.8, cap: util.TIER.INSIDE },
                        ],
                        partial
                    ),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        }

        function versions() {
            const about = deck.about();
            return [
                about.app,
                `deckit ${about.version} (${about.source})`,
                'Electron ' + about.electron,
                'Chrome ' + about.chrome,
            ];
        }
    },
};
