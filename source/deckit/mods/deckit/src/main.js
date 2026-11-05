const { openAddress } = require('./address/open-address.js');
const { switcher } = require('./switcher/switcher.js');

// What a person asks of deckit itself, as commands and as the switcher's actions: an address to open, a mod or the app
// to restart, deckit's folders, and what is running. It has no view.
class Deckit {
    start(deckit) {
        const { util } = deckit;
        const APP_NAME = deckit.about().name;
        const address = openAddress({ open: (url) => deckit.urls.open(url) });
        const STATES = { launching: 'Starting', running: 'Running', notRunning: 'Not running' };

        deckit.commands.register({
            'open-address': {
                run: ({ address: given }) => address.go(given),
                complete: (_param, partial) => address.candidatesFor(partial),
            },
            'restart-mod': {
                run: async ({ mod }) => {
                    await restartMod(mod);
                },
                complete: (_param, partial) => modsFor(partial),
            },
            'restart-app': {
                run: async () => {
                    await deckit.mods.restart();
                },
            },
            'show-mods-folder': { run: () => reveal('mods') },
            'show-data-folder': { run: () => reveal('data') },
            'show-log': { run: () => reveal('log') },
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

        // What the switcher's actions search and do, for attach().
        this.actions = {
            util,
            appName: APP_NAME,
            address,
            modsFor,
            versions,
            does: {
                'open-address': ({ address: given }) => address.go(given),
                'restart-mod': ({ mod }) => restartMod(mod),
                'restart-app': () => deckit.mods.restart(),
                'copy-version': copyVersion,
            },
        };

        // One of deckit's places in `deckit.about()`, shown in Finder.
        async function reveal(place) {
            await deckit.reveal(deckit.about()[place]);
        }

        async function copyVersion({ version }) {
            await deckit.clipboard.writeText(version);
        }

        // One not running is launched, and the mods that require it with it. One that does not restart says why: one
        // that did not load, or one stopping. A refusal is told in a notice.
        function restartMod(id) {
            const mod = deckit.mods.list().found.find((each) => each.id === id);
            if (!mod) throw new Error(`There is no mod ${id}`);
            if (!mod.run) throw new Error(`${mod.name} did not load: ${mod.problem || 'it cannot start'}`);
            if (mod.run.state === 'terminating') throw new Error(`${mod.name} is stopping`);
            return deckit.mods.relaunch(mod.id);
        }

        // Every mod found, each with its state, ranked for `partial` by its name and id.
        function modsFor(partial) {
            const candidates = deckit.mods.list().found.map((mod) => ({
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
            const about = deckit.about();
            return [
                about.app,
                `deckit ${about.version} (${about.source})`,
                ...about.engines.map((engine) => `${engine.name} ${engine.version}`),
            ];
        }
    }

    attach(_shell, deckit) {
        const actions = switcher(this.actions);
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) => quickSwitcher.setActions(actions));
    }
}

module.exports = Deckit;
